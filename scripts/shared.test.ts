import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
	countBySeverity,
	createTempConfig,
	filterExcludedRules,
	generateConfigContent,
	getRuleDirs,
	getRuleDirsRelative,
	isValidLanguage,
	LANG,
	type LintIssue,
	parseLintIssues,
	VALID_LANGUAGES,
} from './shared.ts'

describe('isValidLanguage', () => {
	it('should return true for valid languages', () => {
		expect(isValidLanguage('rust')).toBe(true)
		expect(isValidLanguage('typescript')).toBe(true)
		expect(isValidLanguage('all')).toBe(true)
	})

	it('should return false for invalid languages', () => {
		expect(isValidLanguage('python')).toBe(false)
		expect(isValidLanguage('java')).toBe(false)
		expect(isValidLanguage('')).toBe(false)
		expect(isValidLanguage(null)).toBe(false)
		expect(isValidLanguage(undefined)).toBe(false)
		expect(isValidLanguage(123)).toBe(false)
		expect(isValidLanguage({})).toBe(false)
	})
})

describe('parseLintIssues', () => {
	// Example payloads based on ast-grep JSON output format
	// https://ast-grep.github.io/guide/tools/json.html

	it('should parse a valid ast-grep JSON array with single issue', () => {
		const astGrepOutput = JSON.stringify([
			{
				text: 'console.log("hello")',
				range: {
					byteOffset: { start: 100, end: 120 },
					start: { line: 10, column: 2 },
					end: { line: 10, column: 22 },
				},
				file: 'src/utils.ts',
				lines: '  console.log("hello")',
				language: 'TypeScript',
				ruleId: 'no-console-log',
				severity: 'warning',
				message: 'Avoid using console.log in production code',
			},
		])

		const result = parseLintIssues(astGrepOutput)

		expect(result.error).toBeNull()
		expect(result.issues).toHaveLength(1)
		expect(result.issues[0]).toEqual({
			ruleId: 'no-console-log',
			severity: 'warning',
			message: 'Avoid using console.log in production code',
			file: 'src/utils.ts',
			line: 10,
			column: 2,
			code: 'console.log("hello")',
		})
	})

	it('should parse multiple issues', () => {
		const astGrepOutput = JSON.stringify([
			{
				text: 'dbg!(value)',
				range: {
					byteOffset: { start: 50, end: 61 },
					start: { line: 5, column: 4 },
					end: { line: 5, column: 15 },
				},
				file: 'crates/core/src/lib.rs',
				lines: '    dbg!(value)',
				language: 'Rust',
				ruleId: 'no-dbg-macro',
				severity: 'error',
				message: 'Remove dbg! macro before committing',
			},
			{
				text: 'unwrap()',
				range: {
					byteOffset: { start: 200, end: 208 },
					start: { line: 20, column: 10 },
					end: { line: 20, column: 18 },
				},
				file: 'crates/core/src/lib.rs',
				lines: '    result.unwrap()',
				language: 'Rust',
				ruleId: 'no-unwrap-in-lib',
				severity: 'warning',
				message: 'Avoid using unwrap() in library code',
			},
		])

		const result = parseLintIssues(astGrepOutput)

		expect(result.error).toBeNull()
		expect(result.issues).toHaveLength(2)
		const issue0 = result.issues[0]!
		const issue1 = result.issues[1]!
		expect(issue0.ruleId).toBe('no-dbg-macro')
		expect(issue0.severity).toBe('error')
		expect(issue1.ruleId).toBe('no-unwrap-in-lib')
		expect(issue1.severity).toBe('warning')
	})

	it('should parse empty array', () => {
		const result = parseLintIssues('[]')

		expect(result.error).toBeNull()
		expect(result.issues).toHaveLength(0)
	})

	it('should handle issues with note instead of message', () => {
		const astGrepOutput = JSON.stringify([
			{
				text: 'Some(matched)',
				range: {
					byteOffset: { start: 10828, end: 10841 },
					start: { line: 303, column: 2 },
					end: { line: 303, column: 15 },
				},
				file: 'crates/config/src/rule/mod.rs',
				lines: '  Some(matched)',
				language: 'Rust',
				ruleId: 'test-rule',
				severity: 'hint',
				note: 'Consider using None here\nAdditional context on next line',
			},
		])

		const result = parseLintIssues(astGrepOutput)

		expect(result.error).toBeNull()
		expect(result.issues).toHaveLength(1)
		// Should use first line of note when message is missing
		expect(result.issues[0]!.message).toBe('Consider using None here')
	})

	it('should handle issues with missing optional fields', () => {
		const astGrepOutput = JSON.stringify([
			{
				file: 'test.ts',
				ruleId: 'some-rule',
			},
		])

		const result = parseLintIssues(astGrepOutput)

		expect(result.error).toBeNull()
		expect(result.issues).toHaveLength(1)
		expect(result.issues[0]).toEqual({
			ruleId: 'some-rule',
			severity: 'warning',
			message: 'Lint issue',
			file: 'test.ts',
			line: 1,
			column: 1,
			code: undefined,
		})
	})

	it('should return error for invalid JSON', () => {
		const result = parseLintIssues('not valid json')

		expect(result.error).toContain('Failed to parse JSON')
		expect(result.issues).toHaveLength(0)
	})

	it('should return error for non-array JSON', () => {
		const result = parseLintIssues('{"key": "value"}')

		expect(result.error).toBe('Expected JSON array of lint results')
		expect(result.issues).toHaveLength(0)
	})

	it('should return error for array of non-objects', () => {
		const result = parseLintIssues('["string1", "string2"]')

		expect(result.error).toBe('Expected JSON array of lint results')
		expect(result.issues).toHaveLength(0)
	})

	it('should handle ast-grep output with metaVariables', () => {
		// Full ast-grep output format including metaVariables
		const astGrepOutput = JSON.stringify([
			{
				text: 'Some(matched)',
				range: {
					byteOffset: { start: 10828, end: 10841 },
					start: { line: 303, column: 2 },
					end: { line: 303, column: 15 },
				},
				file: 'crates/config/src/rule/mod.rs',
				lines: '  Some(matched)',
				replacement: 'None',
				replacementOffsets: { start: 10828, end: 10841 },
				language: 'Rust',
				ruleId: 'option-rule',
				severity: 'warning',
				message: 'Consider using None',
				metaVariables: {
					single: {
						A: {
							text: 'matched',
							range: {
								byteOffset: { start: 10833, end: 10840 },
								start: { line: 303, column: 7 },
								end: { line: 303, column: 14 },
							},
						},
					},
					multi: {},
					transformed: {},
				},
			},
		])

		const result = parseLintIssues(astGrepOutput)

		expect(result.error).toBeNull()
		expect(result.issues).toHaveLength(1)
		expect(result.issues[0]!.ruleId).toBe('option-rule')
	})
})

describe('getRuleDirs', () => {
	const mockRoot = '/mock/package/root'

	it('should return rust dirs for rust language', () => {
		const dirs = getRuleDirs(LANG.RUST, mockRoot)

		expect(dirs).toHaveLength(2)
		expect(dirs).toContain(`${mockRoot}/src/shared/rust`)
		expect(dirs).toContain(`${mockRoot}/src/rust/rules`)
	})

	it('should return typescript dirs for typescript language', () => {
		const dirs = getRuleDirs(LANG.TYPESCRIPT, mockRoot)

		expect(dirs).toHaveLength(2)
		expect(dirs).toContain(`${mockRoot}/src/shared/typescript`)
		expect(dirs).toContain(`${mockRoot}/src/typescript/rules`)
	})

	it('should return all dirs for all language', () => {
		const dirs = getRuleDirs(LANG.ALL, mockRoot)

		expect(dirs).toHaveLength(4)
		expect(dirs).toContain(`${mockRoot}/src/shared/rust`)
		expect(dirs).toContain(`${mockRoot}/src/rust/rules`)
		expect(dirs).toContain(`${mockRoot}/src/shared/typescript`)
		expect(dirs).toContain(`${mockRoot}/src/typescript/rules`)
	})
})

describe('getRuleDirsRelative', () => {
	it('should return relative rust dirs for rust language', () => {
		const dirs = getRuleDirsRelative(LANG.RUST)

		expect(dirs).toHaveLength(2)
		expect(dirs).toContain('.ast-grep/rules/shared/rust')
		expect(dirs).toContain('.ast-grep/rules/rust')
	})

	it('should return relative typescript dirs for typescript language', () => {
		const dirs = getRuleDirsRelative(LANG.TYPESCRIPT)

		expect(dirs).toHaveLength(2)
		expect(dirs).toContain('.ast-grep/rules/shared/typescript')
		expect(dirs).toContain('.ast-grep/rules/typescript')
	})

	it('should return all relative dirs for all language', () => {
		const dirs = getRuleDirsRelative(LANG.ALL)

		expect(dirs).toHaveLength(4)
		expect(dirs).toContain('.ast-grep/rules/shared/rust')
		expect(dirs).toContain('.ast-grep/rules/rust')
		expect(dirs).toContain('.ast-grep/rules/shared/typescript')
		expect(dirs).toContain('.ast-grep/rules/typescript')
	})
})

describe('generateConfigContent', () => {
	it('should generate valid YAML config with single rule dir', () => {
		const content = generateConfigContent(['/path/to/rules'])

		expect(content).toBe('ruleDirs:\n  - /path/to/rules\n')
	})

	it('should generate valid YAML config with multiple rule dirs', () => {
		const content = generateConfigContent(['/path/to/rules1', '/path/to/rules2', '/path/to/rules3'])

		expect(content).toBe(
			'ruleDirs:\n  - /path/to/rules1\n  - /path/to/rules2\n  - /path/to/rules3\n',
		)
	})

	it('should generate valid YAML config with empty rule dirs', () => {
		const content = generateConfigContent([])

		expect(content).toBe('ruleDirs:\n\n')
	})
})

describe('createTempConfig', () => {
	let tmpDir: string
	let configPath: string
	let cleanup: () => void

	afterEach(() => {
		// Ensure cleanup is called even if test fails
		if (cleanup) {
			cleanup()
		}
	})

	it('should create temp directory and config file', () => {
		const result = createTempConfig(['/path/to/rules'])
		tmpDir = result.tmpDir
		configPath = result.configPath
		cleanup = result.cleanup

		expect(existsSync(tmpDir)).toBe(true)
		expect(existsSync(configPath)).toBe(true)
		expect(configPath).toBe(join(tmpDir, 'sgconfig.yml'))
	})

	it('should write correct config content', () => {
		const ruleDirs = ['/path/to/rules1', '/path/to/rules2']
		const result = createTempConfig(ruleDirs)
		tmpDir = result.tmpDir
		configPath = result.configPath
		cleanup = result.cleanup

		const content = readFileSync(configPath, 'utf-8')
		expect(content).toBe('ruleDirs:\n  - /path/to/rules1\n  - /path/to/rules2\n')
	})

	it('should cleanup temp directory when cleanup is called', () => {
		const result = createTempConfig(['/path/to/rules'])
		tmpDir = result.tmpDir
		configPath = result.configPath
		cleanup = result.cleanup

		expect(existsSync(tmpDir)).toBe(true)

		cleanup()

		expect(existsSync(tmpDir)).toBe(false)
	})
})

describe('filterExcludedRules', () => {
	const sampleIssues: LintIssue[] = [
		{
			ruleId: 'no-console-log',
			severity: 'warning',
			message: 'No console.log',
			file: 'test.ts',
			line: 1,
			column: 1,
		},
		{
			ruleId: 'no-explicit-any',
			severity: 'error',
			message: 'No explicit any',
			file: 'test.ts',
			line: 2,
			column: 1,
		},
		{
			ruleId: 'prefer-const',
			severity: 'hint',
			message: 'Prefer const',
			file: 'test.ts',
			line: 3,
			column: 1,
		},
	]

	it('should return all issues when no exclusions', () => {
		const result = filterExcludedRules(sampleIssues, [])

		expect(result.filtered).toHaveLength(3)
		expect(result.warnings).toHaveLength(0)
	})

	it('should filter out single excluded rule', () => {
		const result = filterExcludedRules(sampleIssues, ['no-console-log'])

		expect(result.filtered).toHaveLength(2)
		expect(result.filtered.map((i) => i.ruleId)).toEqual(['no-explicit-any', 'prefer-const'])
		expect(result.warnings).toHaveLength(0)
	})

	it('should filter out multiple excluded rules', () => {
		const result = filterExcludedRules(sampleIssues, ['no-console-log', 'prefer-const'])

		expect(result.filtered).toHaveLength(1)
		expect(result.filtered[0]!.ruleId).toBe('no-explicit-any')
		expect(result.warnings).toHaveLength(0)
	})

	it('should warn when excluded rule not found', () => {
		const result = filterExcludedRules(sampleIssues, ['non-existent-rule'])

		expect(result.filtered).toHaveLength(3)
		expect(result.warnings).toHaveLength(1)
		expect(result.warnings[0]).toContain('non-existent-rule')
		expect(result.warnings[0]).toContain('not found')
	})

	it('should warn for multiple non-existent rules', () => {
		const result = filterExcludedRules(sampleIssues, [
			'fake-rule-1',
			'no-console-log',
			'fake-rule-2',
		])

		expect(result.filtered).toHaveLength(2)
		expect(result.warnings).toHaveLength(2)
	})

	it('should handle empty issues array', () => {
		const result = filterExcludedRules([], ['no-console-log'])

		expect(result.filtered).toHaveLength(0)
		expect(result.warnings).toHaveLength(1)
		expect(result.warnings[0]).toContain('no-console-log')
	})
})

describe('countBySeverity', () => {
	it('should count issues by severity', () => {
		const issues: LintIssue[] = [
			{ ruleId: 'r1', severity: 'error', message: '', file: '', line: 1, column: 1 },
			{ ruleId: 'r2', severity: 'error', message: '', file: '', line: 1, column: 1 },
			{ ruleId: 'r3', severity: 'warning', message: '', file: '', line: 1, column: 1 },
			{ ruleId: 'r4', severity: 'hint', message: '', file: '', line: 1, column: 1 },
			{ ruleId: 'r5', severity: 'hint', message: '', file: '', line: 1, column: 1 },
			{ ruleId: 'r6', severity: 'hint', message: '', file: '', line: 1, column: 1 },
		]

		const counts = countBySeverity(issues)

		expect(counts.error).toBe(2)
		expect(counts.warning).toBe(1)
		expect(counts.hint).toBe(3)
	})

	it('should return zero counts for empty array', () => {
		const counts = countBySeverity([])

		expect(counts.error).toBe(0)
		expect(counts.warning).toBe(0)
		expect(counts.hint).toBe(0)
	})

	it('should count unknown severities as hints', () => {
		const issues: LintIssue[] = [
			{ ruleId: 'r1', severity: 'info', message: '', file: '', line: 1, column: 1 },
			{ ruleId: 'r2', severity: 'suggestion', message: '', file: '', line: 1, column: 1 },
		]

		const counts = countBySeverity(issues)

		expect(counts.error).toBe(0)
		expect(counts.warning).toBe(0)
		expect(counts.hint).toBe(2)
	})

	it('should handle only errors', () => {
		const issues: LintIssue[] = [
			{ ruleId: 'r1', severity: 'error', message: '', file: '', line: 1, column: 1 },
			{ ruleId: 'r2', severity: 'error', message: '', file: '', line: 1, column: 1 },
		]

		const counts = countBySeverity(issues)

		expect(counts.error).toBe(2)
		expect(counts.warning).toBe(0)
		expect(counts.hint).toBe(0)
	})
})

describe('VALID_LANGUAGES', () => {
	it('should contain all expected languages', () => {
		expect(VALID_LANGUAGES).toContain('rust')
		expect(VALID_LANGUAGES).toContain('typescript')
		expect(VALID_LANGUAGES).toContain('all')
		expect(VALID_LANGUAGES).toHaveLength(3)
	})
})

describe('LANG constants', () => {
	it('should have correct values', () => {
		expect(LANG.RUST).toBe('rust')
		expect(LANG.TYPESCRIPT).toBe('typescript')
		expect(LANG.ALL).toBe('all')
	})
})
