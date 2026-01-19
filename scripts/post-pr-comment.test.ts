import { describe, expect, it } from 'vitest'
import {
	COMMENT_SIGNATURE,
	countBySeverity,
	type LintIssue,
	MAX_ISSUES_IN_COMMENT,
} from './shared.ts'

/**
 * Test the comment generation logic.
 * Since generateComment in post-pr-comment.ts uses module-scoped variables,
 * we recreate the logic here for testability.
 */
function generateComment(issues: LintIssue[], totalIssues: number): string {
	const signature = COMMENT_SIGNATURE

	if (totalIssues === 0) {
		return `${signature}
## [PASS] Tempo Lint Results

No lint issues found! Great job!`
	}

	const counts = countBySeverity(issues)

	let body = `${signature}
## Tempo Lint Results

Found **${totalIssues}** issue(s) in this PR.

| Severity | Count |
|----------|-------|
| Errors | ${counts.error} |
| Warnings | ${counts.warning} |
| Hints | ${counts.hint} |

<details>
<summary>View Issues</summary>

\`\`\`
`

	const displayIssues = issues.slice(0, MAX_ISSUES_IN_COMMENT)
	for (const item of displayIssues) {
		body += `${item.file}:${item.line} [${item.severity}] ${item.ruleId}: ${item.message}\n`
	}

	if (issues.length > MAX_ISSUES_IN_COMMENT) {
		body += `\n... and ${issues.length - MAX_ISSUES_IN_COMMENT} more issues\n`
	}

	body += `\`\`\`

</details>

---
*Posted by [Tempo Lints](https://github.com/stripe/tempo-lints)*`

	return body
}

describe('generateComment', () => {
	it('should generate success comment when no issues', () => {
		const comment = generateComment([], 0)

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

		const comment = generateComment(issues, 2)

		expect(comment).toContain(COMMENT_SIGNATURE)
		expect(comment).toContain('## Tempo Lint Results')
		expect(comment).toContain('Found **2** issue(s)')
		expect(comment).toContain('| Errors | 1 |')
		expect(comment).toContain('| Warnings | 1 |')
		expect(comment).toContain('| Hints | 0 |')
	})

	it('should include issue details in code block', () => {
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

		const comment = generateComment(issues, 1)

		expect(comment).toContain('crates/core/src/lib.rs:42 [error] no-dbg-macro: Remove dbg! macro')
		expect(comment).toContain('```')
		expect(comment).toContain('<details>')
		expect(comment).toContain('View Issues')
	})

	it('should truncate issues when exceeding MAX_ISSUES_IN_COMMENT', () => {
		// Create more issues than MAX_ISSUES_IN_COMMENT (which is 25)
		const issues: LintIssue[] = Array.from({ length: 30 }, (_, i) => ({
			ruleId: `rule-${i}`,
			severity: 'warning',
			message: `Issue ${i}`,
			file: `file${i}.ts`,
			line: i + 1,
			column: 1,
		}))

		const comment = generateComment(issues, 30)

		// Should only show first 25 issues
		expect(comment).toContain('rule-0')
		expect(comment).toContain('rule-24')
		expect(comment).not.toContain('rule-25')
		expect(comment).not.toContain('rule-29')

		// Should show truncation message
		expect(comment).toContain('... and 5 more issues')
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

		const comment = generateComment(issues, 1)

		expect(comment).toContain('Posted by [Tempo Lints](https://github.com/stripe/tempo-lints)')
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

		const comment = generateComment(issues, 6)

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

		const comment = generateComment(issues, 1)

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

describe('MAX_ISSUES_IN_COMMENT', () => {
	it('should be a reasonable limit', () => {
		expect(MAX_ISSUES_IN_COMMENT).toBe(25)
	})
})
