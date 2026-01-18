#!/usr/bin/env tsx

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const COMMENT_SIGNATURE = '<!-- tempo-lints-comment -->'

export const LANG = {
	RUST: 'rust',
	TYPESCRIPT: 'typescript',
	ALL: 'all',
} as const

export const VALID_LANGUAGES = [LANG.RUST, LANG.TYPESCRIPT, LANG.ALL] as const
export type Language = (typeof VALID_LANGUAGES)[number]

const SEVERITY = {
	ERROR: 'error',
	WARNING: 'warning',
	HINT: 'hint',
} as const

export const MAX_ISSUES_IN_COMMENT = 25

export const PACKAGE_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')

export interface SeverityCounts {
	error: number
	warning: number
	hint: number
}

export interface LintIssue {
	ruleId?: string
	severity?: string
	message?: string
	file?: string
	range?: {
		start?: {
			line?: number
			column?: number
		}
	}
}

export function isValidLanguage(value: unknown): value is Language {
	return typeof value === 'string' && VALID_LANGUAGES.includes(value as Language)
}

function isLintIssueArray(value: unknown): value is LintIssue[] {
	if (!Array.isArray(value)) return false

	const samplesToCheck = Math.min(value.length, 5)
	for (let i = 0; i < samplesToCheck; i++) {
		const item = value[i]
		if (typeof item !== 'object' || item === null) return false
		if (!('ruleId' in item || 'severity' in item || 'message' in item || 'file' in item)) {
			return false
		}
	}

	return true
}

export function parseLintIssues(input: string): { issues: LintIssue[]; error: string | null } {
	const { data, error } = safeParseJSON<unknown>(input)

	if (error) {
		return { issues: [], error: `Failed to parse JSON: ${error.message}` }
	}

	if (!isLintIssueArray(data)) {
		return { issues: [], error: 'Expected JSON array of lint results' }
	}

	return { issues: data, error: null }
}

export function getRuleDirs(language: Language, packageRoot: string = PACKAGE_ROOT): string[] {
	const dirs: string[] = []

	if (language === LANG.RUST || language === LANG.ALL) {
		dirs.push(path.join(packageRoot, 'rules', 'shared', LANG.RUST))
		dirs.push(path.join(packageRoot, 'rules', LANG.RUST))
	}

	if (language === LANG.TYPESCRIPT || language === LANG.ALL) {
		dirs.push(path.join(packageRoot, 'rules', 'shared', LANG.TYPESCRIPT))
		dirs.push(path.join(packageRoot, 'rules', LANG.TYPESCRIPT))
	}

	return dirs
}

/**
 * Get rule directories as relative paths for vendored configs.
 * Used by the vendor command to generate portable sgconfig.yml files.
 */
export function getRuleDirsRelative(language: Language): string[] {
	const dirs: string[] = []

	if (language === LANG.RUST || language === LANG.ALL) {
		dirs.push(`.ast-grep/rules/shared/${LANG.RUST}`)
		dirs.push(`.ast-grep/rules/${LANG.RUST}`)
	}

	if (language === LANG.TYPESCRIPT || language === LANG.ALL) {
		dirs.push(`.ast-grep/rules/shared/${LANG.TYPESCRIPT}`)
		dirs.push(`.ast-grep/rules/${LANG.TYPESCRIPT}`)
	}

	return dirs
}

export function generateConfigContent(ruleDirs: string[]): string {
	return `ruleDirs:\n${ruleDirs.map((d) => `  - ${d}`).join('\n')}\n`
}

export function createTempConfig(ruleDirs: string[]): {
	tmpDir: string
	configPath: string
	cleanup: () => void
} {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tempo-lints-'))
	const configPath = path.join(tmpDir, 'sgconfig.yml')

	fs.writeFileSync(configPath, generateConfigContent(ruleDirs))

	const cleanup = () => {
		try {
			fs.rmSync(tmpDir, { recursive: true, force: true })
		} catch {
			// Ignore cleanup errors
		}
	}

	return { tmpDir, configPath, cleanup }
}

export function filterExcludedRules(
	issues: LintIssue[],
	excludeRules: string[],
): { filtered: LintIssue[]; warnings: string[] } {
	if (excludeRules.length === 0) {
		return { filtered: issues, warnings: [] }
	}

	const excludeSet = new Set(excludeRules)
	const warnings: string[] = []

	const foundRules = new Set<string>()
	for (const item of issues) {
		if (item.ruleId) foundRules.add(item.ruleId)
	}

	for (const excludedRule of excludeSet) {
		if (!foundRules.has(excludedRule)) {
			warnings.push(`Excluded rule "${excludedRule}" was not found in results (possible typo?)`)
		}
	}

	const filtered = issues.filter((item) => !excludeSet.has(item.ruleId ?? ''))

	return { filtered, warnings }
}

export function countBySeverity(issues: LintIssue[]): SeverityCounts {
	const counts: SeverityCounts = { error: 0, warning: 0, hint: 0 }

	for (const item of issues) {
		const sev = item.severity || SEVERITY.HINT
		if (sev === SEVERITY.ERROR) counts.error++
		else if (sev === SEVERITY.WARNING) counts.warning++
		else counts.hint++
	}

	return counts
}

export function warn(message: string): void {
	console.error(`[tempo-lints] warning: ${message}`)
}

function safeParseJSON<T>(input: string): { data: T | null; error: Error | null } {
	try {
		return { data: JSON.parse(input) as T, error: null }
	} catch (err) {
		return { data: null, error: err as Error }
	}
}
