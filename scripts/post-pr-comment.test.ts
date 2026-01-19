import { describe, expect, it } from 'vitest'
import { generateCommentBody } from './post-pr-comment.ts'
import { COMMENT_SIGNATURE, type LintIssue } from './shared.ts'

describe('generateCommentBody', () => {
	it('should generate success comment when no issues', () => {
		const comment = generateCommentBody([], 0)

		expect(comment).toContain(COMMENT_SIGNATURE)
		expect(comment).toContain('[PASS] Tempo Lint Results')
		expect(comment).toContain('No lint issues found!')
	})

	it('should generate comment with issue summary', () => {
		const issues: LintIssue[] = [
			{
				ruleId: 'no-console-log',
				severity: 'warning',
				message: 'Avoid console.log',
				file: 'src/utils.ts',
				line: 10,
				column: 1,
			},
			{
				ruleId: 'no-explicit-any',
				severity: 'error',
				message: 'No explicit any',
				file: 'src/types.ts',
				line: 5,
				column: 3,
			},
		]

		const comment = generateCommentBody(issues, 2)

		expect(comment).toContain(COMMENT_SIGNATURE)
		expect(comment).toContain('## Tempo Lint Results')
		expect(comment).toContain('### Summary')
		expect(comment).toContain('Found **2** issue(s) across **2** file(s)')
		expect(comment).toContain('| Errors | 1 |')
		expect(comment).toContain('| Warnings | 1 |')
		expect(comment).toContain('| Hints | 0 |')
	})

	it('should include issue details grouped by rule', () => {
		const issues: LintIssue[] = [
			{
				ruleId: 'no-dbg-macro',
				severity: 'error',
				message: 'Remove dbg! macro',
				file: 'crates/core/src/lib.rs',
				line: 42,
				column: 4,
			},
		]

		const comment = generateCommentBody(issues, 1)

		expect(comment).toContain('### Issues by Rule Type')
		expect(comment).toContain('<code>no-dbg-macro</code>')
		expect(comment).toContain('`crates/core/src/lib.rs:42` - Remove dbg! macro')
		expect(comment).toContain('<details>')
		expect(comment).toContain('### Issues by File')
	})

	it('should group and truncate issues by rule', () => {
		// Create 15 issues with the same rule and 5 with another
		const issues: LintIssue[] = [
			...Array.from({ length: 15 }, (_, i) => ({
				ruleId: 'common-rule',
				severity: 'warning',
				message: `Issue ${i}`,
				file: `file${i}.ts`,
				line: i + 1,
				column: 1,
			})),
			...Array.from({ length: 5 }, (_, i) => ({
				ruleId: 'rare-rule',
				severity: 'error',
				message: `Error ${i}`,
				file: `error${i}.ts`,
				line: i + 1,
				column: 1,
			})),
		]

		const comment = generateCommentBody(issues, 20)

		// Should show rule groupings
		expect(comment).toContain('<code>common-rule</code>')
		expect(comment).toContain('(15 occurrences)')
		expect(comment).toContain('<code>rare-rule</code>')
		expect(comment).toContain('(5 occurrences)')

		// Should truncate common-rule to 10 issues
		expect(comment).toContain('*... and 5 more*')
	})

	it('should include footer with link', () => {
		const issues: LintIssue[] = [
			{
				ruleId: 'test-rule',
				severity: 'hint',
				message: 'Test',
				file: 'test.ts',
				line: 1,
				column: 1,
			},
		]

		const comment = generateCommentBody(issues, 1)

		expect(comment).toContain('Posted by https://github.com/tempoxyz/lints')
	})

	it('should correctly count mixed severity issues', () => {
		const issues: LintIssue[] = [
			{ ruleId: 'r1', severity: 'error', message: 'Error 1', file: 'f1.ts', line: 1, column: 1 },
			{ ruleId: 'r2', severity: 'error', message: 'Error 2', file: 'f2.ts', line: 2, column: 1 },
			{ ruleId: 'r3', severity: 'error', message: 'Error 3', file: 'f3.ts', line: 3, column: 1 },
			{ ruleId: 'r4', severity: 'warning', message: 'Warn 1', file: 'f4.ts', line: 4, column: 1 },
			{ ruleId: 'r5', severity: 'warning', message: 'Warn 2', file: 'f5.ts', line: 5, column: 1 },
			{ ruleId: 'r6', severity: 'hint', message: 'Hint 1', file: 'f6.ts', line: 6, column: 1 },
		]

		const comment = generateCommentBody(issues, 6)

		expect(comment).toContain('| Errors | 3 |')
		expect(comment).toContain('| Warnings | 2 |')
		expect(comment).toContain('| Hints | 1 |')
	})

	it('should handle issues with special characters in message', () => {
		const issues: LintIssue[] = [
			{
				ruleId: 'test-rule',
				severity: 'warning',
				message: 'Message with <html> & "quotes" and `backticks`',
				file: 'test.ts',
				line: 1,
				column: 1,
			},
		]

		const comment = generateCommentBody(issues, 1)

		expect(comment).toContain('<html>')
		expect(comment).toContain('&')
		expect(comment).toContain('"quotes"')
		expect(comment).toContain('`backticks`')
	})
})

describe('COMMENT_SIGNATURE', () => {
	it('should be an HTML comment for identification', () => {
		expect(COMMENT_SIGNATURE).toBe('<!-- tempo-lints-comment -->')
	})
})
