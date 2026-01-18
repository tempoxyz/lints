#!/usr/bin/env tsx

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { Command } from 'commander'
import {
	countBySeverity,
	createTempConfig,
	filterExcludedRules,
	generateConfigContent,
	getRuleDirs,
	getRuleDirsRelative,
	isValidLanguage,
	LANG,
	type Language,
	type LintIssue,
	PACKAGE_ROOT,
	parseLintIssues,
	VALID_LANGUAGES,
	warn,
} from '../scripts/shared.ts'

function getVersion(): string {
	const pkgPath = path.join(PACKAGE_ROOT, 'package.json')
	const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { version?: string }
	return pkg.version ?? '0.0.0'
}

interface ScanOptions {
	exclude?: string
	json?: boolean
	fix?: boolean
	githubAction?: boolean
}

function runScan(language: string, scanPath: string, options: ScanOptions): void {
	if (!isValidLanguage(language)) {
		console.error(
			`Error: Invalid language '${language}'. Must be one of: ${VALID_LANGUAGES.join(', ')}`,
		)
		process.exit(1)
	}

	const ruleDirs = getRuleDirs(language)
	const { configPath, cleanup } = createTempConfig(ruleDirs)

	const excludeRules = options.exclude?.split(',').map((r) => r.trim()) ?? []

	runAstGrep(configPath, scanPath, {
		json: options.json ?? false,
		fix: options.fix ?? false,
		githubAction: options.githubAction ?? false,
		excludeRules,
		cleanup,
	})
}

interface AstGrepOptions {
	json: boolean
	fix: boolean
	githubAction: boolean
	excludeRules: string[]
	cleanup: () => void
}

function runAstGrep(configPath: string, scanPath: string, options: AstGrepOptions): void {
	const { cleanup } = options

	const handleSignal = (signal: 'SIGINT' | 'SIGTERM') => {
		cleanup()
		process.exit(128 + (signal === 'SIGINT' ? 2 : 15))
	}

	process.on('SIGINT', () => handleSignal('SIGINT'))
	process.on('SIGTERM', () => handleSignal('SIGTERM'))

	const args = ['scan', '--config', configPath]

	const useJson = options.json || options.githubAction
	if (useJson) {
		args.push('--json')
	}

	if (options.fix) {
		args.push('--update-all')
	}

	args.push(scanPath)

	const localAstGrep = path.join(PACKAGE_ROOT, 'node_modules', '.bin', 'ast-grep')
	const astGrepPath = fs.existsSync(localAstGrep) ? localAstGrep : 'ast-grep'

	const proc = spawn(astGrepPath, args, {
		stdio: useJson ? ['inherit', 'pipe', 'inherit'] : 'inherit',
		shell: process.platform === 'win32',
	})

	let output = ''

	if (useJson && proc.stdout) {
		proc.stdout.on('data', (data: Buffer) => {
			output += data.toString()
		})
	}

	proc.on('close', (code) => {
		cleanup()

		if (useJson && output) {
			const { issues, error } = parseLintIssues(output)

			if (error) {
				warn(error)
				console.log(output)
				process.exit(code ?? 1)
				return
			}

			const { filtered, warnings } = filterExcludedRules(issues, options.excludeRules)
			for (const w of warnings) warn(w)

			if (options.githubAction) {
				outputForGitHubAction(filtered)
			} else {
				console.log(JSON.stringify(filtered, null, 2))
			}

			const counts = countBySeverity(filtered)
			if (counts.error > 0) {
				process.exit(1)
			}
		} else {
			process.exit(code ?? 0)
		}
	})

	proc.on('error', (err) => {
		cleanup()
		console.error(`Error running ast-grep: ${err.message}`)
		console.error('Make sure ast-grep is installed: npm install -g @ast-grep/cli')
		process.exit(1)
	})
}

function outputForGitHubAction(issues: LintIssue[]): void {
	const counts = countBySeverity(issues)
	const total = issues.length
	const hasErrors = counts.error > 0

	for (const issue of issues) {
		const file = issue.file ?? 'unknown'
		const line = issue.range?.start?.line ?? 1
		const col = issue.range?.start?.column ?? 1
		const severity = issue.severity ?? 'warning'
		const ruleId = issue.ruleId ?? 'unknown'
		const message = issue.message ?? 'Lint issue'

		const annotationType = severity === 'error' ? 'error' : 'warning'
		console.log(`::${annotationType} file=${file},line=${line},col=${col}::${ruleId}: ${message}`)
	}

	console.log('')
	console.log('========================================')
	console.log('Tempo Lint Results')
	console.log('========================================')
	console.log(`Total issues: ${total}`)
	console.log(`Errors: ${counts.error}`)
	console.log(`Warnings: ${counts.warning}`)
	console.log(`Hints: ${counts.hint}`)
	console.log('')

	if (total === 0) {
		console.log('No lint issues found!')
	} else {
		for (const issue of issues) {
			const file = issue.file ?? 'unknown'
			const line = issue.range?.start?.line ?? '?'
			const severity = issue.severity ?? 'warning'
			const ruleId = issue.ruleId ?? 'unknown'
			const message = issue.message ?? 'Lint issue'

			const prefix = severity === 'error' ? '[ERROR]' : severity === 'warning' ? '[WARN]' : '[HINT]'
			console.log(`${prefix} ${file}:${line}`)
			console.log(`[${ruleId}] ${message}`)
			console.log('')
		}
	}

	// Write outputs to GITHUB_OUTPUT file (modern syntax)
	const githubOutput = process.env.GITHUB_OUTPUT
	if (githubOutput) {
		fs.appendFileSync(githubOutput, `total_issues=${total}\n`)
		fs.appendFileSync(githubOutput, `has_errors=${hasErrors}\n`)
	}
}

interface VendorOptions {
	lang: string
	dest: string
}

function runVendor(options: VendorOptions): void {
	const { lang, dest } = options

	if (!isValidLanguage(lang)) {
		console.error(
			`Error: Invalid language '${lang}'. Must be one of: ${VALID_LANGUAGES.join(', ')}`,
		)
		process.exit(1)
	}

	const language = lang as Language
	const astGrepDir = path.join(dest, '.ast-grep')
	fs.mkdirSync(astGrepDir, { recursive: true })

	console.log(`Vendoring Tempo lints to ${astGrepDir}...`)

	// Copy shared rules
	if (language === LANG.RUST || language === LANG.ALL) {
		copyDir(
			path.join(PACKAGE_ROOT, 'rules', 'shared', LANG.RUST),
			path.join(astGrepDir, 'rules', 'shared', LANG.RUST),
		)
		console.log(`Copied rules/shared/${LANG.RUST}/`)
	}

	if (language === LANG.TYPESCRIPT || language === LANG.ALL) {
		copyDir(
			path.join(PACKAGE_ROOT, 'rules', 'shared', LANG.TYPESCRIPT),
			path.join(astGrepDir, 'rules', 'shared', LANG.TYPESCRIPT),
		)
		console.log(`Copied rules/shared/${LANG.TYPESCRIPT}/`)
	}

	// Copy language-specific rules
	if (language === LANG.RUST || language === LANG.ALL) {
		copyDir(path.join(PACKAGE_ROOT, 'rules', LANG.RUST), path.join(astGrepDir, 'rules', LANG.RUST))
		console.log(`Copied rules/${LANG.RUST}/`)
	}

	if (language === LANG.TYPESCRIPT || language === LANG.ALL) {
		copyDir(path.join(PACKAGE_ROOT, 'rules', LANG.TYPESCRIPT), path.join(astGrepDir, 'rules', LANG.TYPESCRIPT))
		console.log(`Copied rules/${LANG.TYPESCRIPT}/`)
	}

	// Create sgconfig.yml using relative paths for vendored rules
	const ruleDirs = getRuleDirsRelative(language)
	fs.writeFileSync(path.join(dest, 'sgconfig.yml'), generateConfigContent(ruleDirs))

	console.log('Created sgconfig.yml')
	console.log('')
	console.log('Done! Run: ast-grep scan --config sgconfig.yml')
}

function copyDir(src: string, destDir: string): void {
	fs.mkdirSync(destDir, { recursive: true })
	const entries = fs.readdirSync(src, { withFileTypes: true })
	for (const entry of entries) {
		const srcPath = path.join(src, entry.name)
		const destPath = path.join(destDir, entry.name)
		if (entry.isDirectory()) {
			copyDir(srcPath, destPath)
		} else {
			fs.copyFileSync(srcPath, destPath)
		}
	}
}

const program = new Command()

program
	.name('tempo-lints')
	.description('Shared ast-grep lint rules for Tempo projects')
	.version(getVersion())

program
	.argument('<language>', `Language to lint: ${VALID_LANGUAGES.join(', ')}`)
	.argument('[path]', 'Path to scan', '.')
	.option('--exclude <rules>', 'Comma-separated list of rules to exclude')
	.option('--json', 'Output results as JSON')
	.option('--fix', 'Apply auto-fixes where available')
	.option('--github-action', 'Output in GitHub Actions format with annotations')
	.action((language: string, scanPath: string, options: ScanOptions) => {
		runScan(language, scanPath, options)
	})

program
	.command('vendor')
	.description('Copy lint rules to a destination project for offline/locked usage')
	.requiredOption('--lang <language>', `Language rules to vendor: ${VALID_LANGUAGES.join(', ')}`)
	.requiredOption('--dest <path>', 'Destination project path')
	.action((options: VendorOptions) => {
		runVendor(options)
	})

program.parse()
