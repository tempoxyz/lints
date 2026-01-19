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

export const MAX_ISSUES_PER_RULE = 10
export const MAX_ISSUES_PER_FILE = 5
export const MAX_FILES_TO_DISPLAY = 10

export const PACKAGE_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')

export interface SeverityCounts {
	error: number
	warning: number
	hint: number
}

// ast-grep's actual JSON output format
export interface AstGrepIssue {
	text?: string
	range?: {
		start?: {
			line?: number
			column?: number
		}
		end?: {
			line?: number
			column?: number
		}
	}
	file?: string
	lines?: string
	language?: string
	ruleId?: string
	severity?: string
	message?: string // From rule definition
	note?: string // From rule definition
}

// Normalized issue format for output
export interface LintIssue {
	ruleId: string
	severity: string
	message: string
	file: string
	line: number
	column: number
	code?: string
}

export function isValidLanguage(value: unknown): value is Language {
	return typeof value === 'string' && VALID_LANGUAGES.includes(value as Language)
}

function isAstGrepIssueArray(value: unknown): value is AstGrepIssue[] {
	if (!Array.isArray(value)) return false

	const samplesToCheck = Math.min(value.length, 5)
	for (let i = 0; i < samplesToCheck; i++) {
		const item = value[i]
		if (typeof item !== 'object' || item === null) return false
		// Require ruleId field to ensure we only accept lint rule violations
		// This filters out parse errors and other non-lint entries
		if (!('ruleId' in item)) {
			return false
		}
	}

	return true
}

function normalizeIssue(issue: AstGrepIssue): LintIssue {
	return {
		ruleId: issue.ruleId ?? 'unknown',
		severity: issue.severity ?? 'warning',
		message: issue.message ?? issue.note?.split('\n')[0] ?? 'Lint issue',
		file: issue.file ?? 'unknown',
		line: issue.range?.start?.line ?? 1,
		column: issue.range?.start?.column ?? 1,
		code: issue.lines?.trim(),
	}
}

export function parseLintIssues(
	input: string,
	validRuleIds?: Set<string>,
): { issues: LintIssue[]; error: string | null } {
	const { data, error } = safeParseJSON<unknown>(input)

	if (error) {
		return { issues: [], error: `Failed to parse JSON: ${error.message}` }
	}

	if (!isAstGrepIssueArray(data)) {
		return { issues: [], error: 'Expected JSON array of lint results' }
	}

	// Normalize ast-grep issues to our format
	let issues = data.map(normalizeIssue)

	// Filter by valid rule IDs if provided (to exclude non-tempo lint entries)
	if (validRuleIds) {
		const filteredOut: LintIssue[] = []
		issues = issues.filter((issue) => {
			if (validRuleIds.has(issue.ruleId)) {
				return true
			}
			filteredOut.push(issue)
			return false
		})

		// Warn about filtered issues
		for (const issue of filteredOut) {
			warn(`Filtered out non-tempo lint issue: ${issue.ruleId} in ${issue.file}:${issue.line}`)
		}
	}

	return { issues, error: null }
}

export function getRuleDirs(language: Language, packageRoot: string = PACKAGE_ROOT): string[] {
	const dirs: string[] = []

	if (language === LANG.RUST || language === LANG.ALL) {
		dirs.push(path.join(packageRoot, 'src', 'shared', LANG.RUST))
		dirs.push(path.join(packageRoot, 'src', LANG.RUST, 'rules'))
	}

	if (language === LANG.TYPESCRIPT || language === LANG.ALL) {
		dirs.push(path.join(packageRoot, 'src', 'shared', LANG.TYPESCRIPT))
		dirs.push(path.join(packageRoot, 'src', LANG.TYPESCRIPT, 'rules'))
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

/**
 * Get all valid rule IDs for a given language by scanning rule directories.
 * This is used to filter out non-lint entries from the output.
 */
export function getValidRuleIds(
	language: Language,
	packageRoot: string = PACKAGE_ROOT,
): Set<string> {
	const ruleDirs = getRuleDirs(language, packageRoot)
	const ids = new Set<string>()

	for (const dir of ruleDirs) {
		if (!fs.existsSync(dir)) {
			continue
		}

		const files = fs.readdirSync(dir)
		for (const file of files) {
			if (file.endsWith('.yml')) {
				const filePath = path.join(dir, file)
				const content = fs.readFileSync(filePath, 'utf8')
				const match = content.match(/^id:\s*(.+)$/m)
				if (match?.[1]) {
					ids.add(match[1].trim())
				}
			}
		}
	}

	return ids
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
		foundRules.add(item.ruleId)
	}

	for (const excludedRule of excludeSet) {
		if (!foundRules.has(excludedRule)) {
			warnings.push(`Excluded rule "${excludedRule}" was not found in results (possible typo?)`)
		}
	}

	const filtered = issues.filter((item) => !excludeSet.has(item.ruleId))

	return { filtered, warnings }
}

export function countBySeverity(issues: LintIssue[]): SeverityCounts {
	const counts: SeverityCounts = { error: 0, warning: 0, hint: 0 }

	for (const item of issues) {
		if (item.severity === SEVERITY.ERROR) counts.error++
		else if (item.severity === SEVERITY.WARNING) counts.warning++
		else counts.hint++
	}

	return counts
}

/**
 * Generic groupBy function that groups items by a key selector.
 * @param items Array of items to group
 * @param keySelector Function that extracts the key from each item
 * @returns Record with keys and arrays of grouped items
 */
export function groupBy<T>(items: T[], keySelector: (item: T) => string): Record<string, T[]> {
	return items.reduce(
		(acc, item) => {
			const key = keySelector(item)
			if (!acc[key]) acc[key] = []
			acc[key].push(item)
			return acc
		},
		{} as Record<string, T[]>,
	)
}

export function groupByFile(issues: LintIssue[]): Record<string, LintIssue[]> {
	return groupBy(issues, (issue) => issue.file)
}

export function groupByRule(issues: LintIssue[]): Record<string, LintIssue[]> {
	return groupBy(issues, (issue) => issue.ruleId)
}

/**
 * Returns a pluralized string based on the count.
 * @param count The count to check
 * @param singular The singular form of the word
 * @param plural The plural form (defaults to singular + 's')
 * @returns The word with appropriate form
 */
export function pluralize(count: number, singular: string, plural?: string): string {
	return count === 1 ? singular : plural ?? `${singular}s`
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
