/**
 * Integration tests for the GitHub Action
 * Tests the full flow: lint → JSON output → PR comment generation
 */

import { execSync } from 'node:child_process'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { countBySeverity, type LintIssue, PACKAGE_ROOT, parseLintIssues } from './shared.ts'

const FIXTURES_DIR = path.join(PACKAGE_ROOT, 'test-fixtures/rust')
const CLI_PATH = path.join(PACKAGE_ROOT, 'bin/tempo-lints.ts')

function runLintsOnFixtures(): LintIssue[] {
	try {
		const output = execSync(`pnpm exec tsx "${CLI_PATH}" rust "${FIXTURES_DIR}" --json`, {
			encoding: 'utf8',
			cwd: PACKAGE_ROOT,
			stdio: ['pipe', 'pipe', 'pipe'],
		})

		const { issues, error } = parseLintIssues(output)
		if (error) {
			throw new Error(`Failed to parse lint output: ${error}`)
		}
		return issues
	} catch (err) {
		// execSync throws on non-zero exit, but we still want the output
		const error = err as { stdout?: string }
		if (error.stdout) {
			const { issues, error: parseError } = parseLintIssues(error.stdout)
			if (!parseError) {
				return issues
			}
		}
		throw err
	}
}

describe('Action Integration Tests', () => {
	it('should find lint violations in test fixtures', () => {
		const issues = runLintsOnFixtures()
		expect(issues.length).toBeGreaterThan(0)
	})

	it('should only return tempo lint rule IDs (not other tools)', () => {
		const issues = runLintsOnFixtures()

		// All rule IDs should be from tempo lints, not other tools
		for (const issue of issues) {
			expect(issue.ruleId).not.toMatch(/^clippy::/)
			expect(issue.ruleId).not.toBe('unknown')
		}
	})

	it('should find dbg! macro violations', () => {
		const issues = runLintsOnFixtures()
		const dbgIssues = issues.filter((issue) => issue.ruleId === 'no-dbg-macro')
		expect(dbgIssues.length).toBeGreaterThan(0)
	})

	it('should find unwrap violations', () => {
		const issues = runLintsOnFixtures()
		const unwrapIssues = issues.filter((issue) => issue.ruleId === 'no-unwrap-in-lib')
		expect(unwrapIssues.length).toBeGreaterThan(0)
	})

	it('should return issues with all required fields', () => {
		const issues = runLintsOnFixtures()

		for (const issue of issues) {
			expect(issue.ruleId).toBeTruthy()
			expect(issue.file).toBeTruthy()
			expect(issue.line).toBeGreaterThan(0)
			expect(issue.severity).toBeTruthy()
			expect(issue.message).toBeTruthy()
		}
	})

	it('should correctly count issues by severity', () => {
		const issues = runLintsOnFixtures()
		const counts = countBySeverity(issues)

		expect(counts.error).toBeGreaterThanOrEqual(0)
		expect(counts.warning).toBeGreaterThanOrEqual(0)
		expect(counts.hint).toBeGreaterThanOrEqual(0)
		expect(counts.error + counts.warning + counts.hint).toBe(issues.length)
	})

	it('should generate valid JSON output', () => {
		let output: string
		try {
			output = execSync(`pnpm exec tsx "${CLI_PATH}" rust "${FIXTURES_DIR}" --json`, {
				encoding: 'utf8',
				cwd: PACKAGE_ROOT,
				stdio: ['pipe', 'pipe', 'pipe'],
			})
		} catch (err) {
			// Command exits with non-zero when errors are found, but still outputs JSON
			const error = err as { stdout?: string }
			output = error.stdout || ''
		}

		// Should be valid JSON
		expect(() => JSON.parse(output)).not.toThrow()

		// Should be an array
		const parsed = JSON.parse(output)
		expect(Array.isArray(parsed)).toBe(true)
	})
})
