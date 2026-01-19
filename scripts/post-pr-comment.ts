#!/usr/bin/env tsx

import fs from 'node:fs'
import {
	COMMENT_SIGNATURE,
	countBySeverity,
	getValidRuleIds,
	groupByFile,
	groupByRule,
	isValidLanguage,
	type Language,
	type LintIssue,
	MAX_FILES_TO_DISPLAY,
	MAX_ISSUES_PER_FILE,
	MAX_ISSUES_PER_RULE,
	parseLintIssues,
	pluralize,
	warn,
} from './shared.ts'

interface GitHubComment {
	id?: number
	body?: string
}

interface GitHubErrorResponse {
	message?: string
	documentation_url?: string
}

class GitHubApiError extends Error {
	constructor(
		public status: number,
		message: string,
	) {
		super(`GitHub API error (${status}): ${message}`)
		this.name = 'GitHubApiError'
	}
}

async function githubRequest<T>(
	method: string,
	path: string,
	body: object | null = null,
	githubToken: string,
): Promise<{ status: number; data: T }> {
	const url = `https://api.github.com${path}`

	const response = await fetch(url, {
		method,
		headers: {
			Authorization: `token ${githubToken}`,
			Accept: 'application/vnd.github.v3+json',
			'User-Agent': 'tempo-lints',
			'Content-Type': 'application/json',
		},
		body: body ? JSON.stringify(body) : undefined,
	})

	let data: T
	try {
		data = (await response.json()) as T
	} catch {
		data = {} as T
	}

	// Check for error responses (4xx and 5xx status codes)
	if (response.status >= 400) {
		const errorData = data as unknown as GitHubErrorResponse
		const errorMessage = errorData.message || `Request failed with status ${response.status}`
		throw new GitHubApiError(response.status, errorMessage)
	}

	return { status: response.status, data }
}

/**
 * Generates a PR comment body from lint issues.
 * Exported for testing purposes.
 * @param issues The lint issues to format
 * @param totalIssuesCount The total number of issues (may differ from issues.length if filtered)
 * @returns Formatted markdown comment body
 */
export function generateCommentBody(issues: LintIssue[], totalIssuesCount: number): string {
	const signature = COMMENT_SIGNATURE

	if (totalIssuesCount === 0) {
		return `${signature}
## [PASS] Tempo Lint Results

No lint issues found! Great job!`
	}

	const counts = countBySeverity(issues)
	const fileGroups = groupByFile(issues)
	const ruleGroups = groupByRule(issues)

	let body = `${signature}
## Tempo Lint Results

### Summary
Found **${totalIssuesCount}** issue(s) across **${Object.keys(fileGroups).length}** file(s)

| Severity | Count |
|----------|-------|
| Errors | ${counts.error} |
| Warnings | ${counts.warning} |
| Hints | ${counts.hint} |

---

### Issues by Rule Type
`

	// Sort rules by frequency (most common first)
	const sortedRules = Object.entries(ruleGroups).sort(([, a], [, b]) => b.length - a.length)

	for (const [ruleId, ruleIssues] of sortedRules) {
		body += `\n<details>\n<summary><code>${ruleId}</code> (${ruleIssues.length} ${pluralize(ruleIssues.length, 'occurrence')})</summary>\n\n`

		// Show up to MAX_ISSUES_PER_RULE issues per rule
		const displayCount = Math.min(ruleIssues.length, MAX_ISSUES_PER_RULE)
		for (let i = 0; i < displayCount; i++) {
			const issue = ruleIssues[i]
			body += `- \`${issue.file}:${issue.line}\` - ${issue.message}\n`
		}

		if (ruleIssues.length > MAX_ISSUES_PER_RULE) {
			body += `\n*... and ${ruleIssues.length - MAX_ISSUES_PER_RULE} more*\n`
		}

		body += `\n</details>\n`
	}

	// Add "by file" view
	body += `\n### Issues by File\n\n<details>\n<summary>View grouped by file</summary>\n\n`

	const sortedFiles = Object.entries(fileGroups).sort(([, a], [, b]) => b.length - a.length)
	const displayFiles = sortedFiles.slice(0, MAX_FILES_TO_DISPLAY)

	for (const [file, fileIssues] of displayFiles) {
		body += `\n**${file}** (${fileIssues.length} ${pluralize(fileIssues.length, 'issue')})\n`

		// Show up to MAX_ISSUES_PER_FILE issues per file
		const displayCount = Math.min(fileIssues.length, MAX_ISSUES_PER_FILE)
		for (let i = 0; i < displayCount; i++) {
			const issue = fileIssues[i]
			body += `- Line ${issue.line}: [${issue.severity}] ${issue.ruleId}\n`
		}

		if (fileIssues.length > MAX_ISSUES_PER_FILE) {
			body += `- *... and ${fileIssues.length - MAX_ISSUES_PER_FILE} more*\n`
		}
	}

	if (sortedFiles.length > MAX_FILES_TO_DISPLAY) {
		body += `\n*Showing ${MAX_FILES_TO_DISPLAY} of ${sortedFiles.length} files*\n`
	}

	body += `\n</details>\n\n---\n*Posted by https://github.com/tempoxyz/lints*`

	return body
}

async function findExistingComment(
	repo: string,
	prNumber: string,
	githubToken: string,
): Promise<number | null> {
	const { data } = await githubRequest<GitHubComment[]>(
		'GET',
		`/repos/${repo}/issues/${prNumber}/comments`,
		null,
		githubToken,
	)

	if (!Array.isArray(data)) return null

	for (const comment of data) {
		if (comment.body?.includes(COMMENT_SIGNATURE)) {
			return comment.id ?? null
		}
	}

	return null
}

async function main(
	outputFile: string,
	totalIssues: number,
	repo: string,
	prNumber: string,
	language: Language,
	githubToken: string,
): Promise<void> {
	let issues: LintIssue[] = []
	if (outputFile && fs.existsSync(outputFile)) {
		try {
			const content = fs.readFileSync(outputFile, 'utf8')
			// Get valid rule IDs to filter out non-tempo lint entries
			const validRuleIds = getValidRuleIds(language)
			const result = parseLintIssues(content, validRuleIds)
			if (result.error) {
				warn(`Lint output: ${result.error}`)
			}
			issues = result.issues
		} catch (err) {
			warn(`Failed to read lint output file: ${(err as Error).message}`)
		}
	}

	const commentBody = generateCommentBody(issues, totalIssues)
	const existingCommentId = await findExistingComment(repo, prNumber, githubToken)

	try {
		if (existingCommentId) {
			console.log(`Updating existing comment ${existingCommentId}...`)
			await githubRequest<GitHubComment>(
				'PATCH',
				`/repos/${repo}/issues/comments/${existingCommentId}`,
				{ body: commentBody },
				githubToken,
			)
		} else {
			console.log('Creating new comment...')
			await githubRequest<GitHubComment>(
				'POST',
				`/repos/${repo}/issues/${prNumber}/comments`,
				{ body: commentBody },
				githubToken,
			)
		}

		console.log('PR comment posted successfully!')
	} catch (err) {
		warn(`Error posting comment: ${(err as Error).message}`)
		process.exit(1)
	}
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	const [, , outputFile, totalIssuesStr, repo, prNumber, languageArg] = process.argv
	const totalIssues = Number.parseInt(totalIssuesStr ?? '0', 10) || 0
	const githubToken = process.env.GITHUB_TOKEN

	if (!githubToken) {
		warn('GITHUB_TOKEN environment variable is required')
		process.exit(1)
	}

	if (!repo || !prNumber) {
		warn('Repository and PR number are required')
		console.error(
			'Usage: tsx post-pr-comment.ts <output_file> <total_issues> <repo> <pr_number> <language>',
		)
		process.exit(1)
	}

	if (!languageArg || !isValidLanguage(languageArg)) {
		warn(`Invalid language: ${languageArg}. Must be one of: rust, typescript, all`)
		process.exit(1)
	}

	// Type assertion safe after validation
	const language: Language = languageArg as Language

	main(outputFile, totalIssues, repo, prNumber, language, githubToken).catch((err: Error) => {
		warn(err.message)
		process.exit(1)
	})
}
