#!/usr/bin/env tsx

import fs from 'node:fs'
import {
	COMMENT_SIGNATURE,
	countBySeverity,
	type LintIssue,
	MAX_ISSUES_IN_COMMENT,
	parseLintIssues,
	warn,
} from './shared.ts'

const [, , outputFile, totalIssuesStr, repo, prNumber] = process.argv
const totalIssues = Number.parseInt(totalIssuesStr ?? '0', 10) || 0
const githubToken = process.env.GITHUB_TOKEN

if (!githubToken) {
	warn('GITHUB_TOKEN environment variable is required')
	process.exit(1)
}

if (!repo || !prNumber) {
	warn('Repository and PR number are required')
	console.error('Usage: tsx post-pr-comment.ts <output_file> <total_issues> <repo> <pr_number>')
	process.exit(1)
}

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

function generateComment(issues: LintIssue[]): string {
	const signature = COMMENT_SIGNATURE

	if (totalIssues === 0) {
		return `${signature}
## ✅ Tempo Lint Results

No lint issues found! Great job! 🎉`
	}

	const counts = countBySeverity(issues)

	let body = `${signature}
## 🔍 Tempo Lint Results

Found **${totalIssues}** issue(s) in this PR.

| Severity | Count |
|----------|-------|
| ❌ Errors | ${counts.error} |
| ⚠️ Warnings | ${counts.warning} |
| 💡 Hints | ${counts.hint} |

<details>
<summary>View Issues</summary>

\`\`\`
`

	const displayIssues = issues.slice(0, MAX_ISSUES_IN_COMMENT)
	for (const item of displayIssues) {
		const line = item.range?.start?.line ?? '?'
		body += `${item.file}:${line} [${item.severity}] ${item.ruleId}: ${item.message}\n`
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

async function findExistingComment(): Promise<number | null> {
	const { data } = await githubRequest<GitHubComment[]>(
		'GET',
		`/repos/${repo}/issues/${prNumber}/comments`,
	)

	if (!Array.isArray(data)) return null

	for (const comment of data) {
		if (comment.body?.includes(COMMENT_SIGNATURE)) {
			return comment.id ?? null
		}
	}

	return null
}

async function main(): Promise<void> {
	let issues: LintIssue[] = []
	if (outputFile && fs.existsSync(outputFile)) {
		try {
			const content = fs.readFileSync(outputFile, 'utf8')
			const result = parseLintIssues(content)
			if (result.error) {
				warn(`Lint output: ${result.error}`)
			}
			issues = result.issues
		} catch (err) {
			warn(`Failed to read lint output file: ${(err as Error).message}`)
		}
	}

	const commentBody = generateComment(issues)
	const existingCommentId = await findExistingComment()

	try {
		if (existingCommentId) {
			console.log(`Updating existing comment ${existingCommentId}...`)
			await githubRequest<GitHubComment>(
				'PATCH',
				`/repos/${repo}/issues/comments/${existingCommentId}`,
				{ body: commentBody },
			)
		} else {
			console.log('Creating new comment...')
			await githubRequest<GitHubComment>('POST', `/repos/${repo}/issues/${prNumber}/comments`, {
				body: commentBody,
			})
		}

		console.log('PR comment posted successfully!')
	} catch (err) {
		warn(`Error posting comment: ${(err as Error).message}`)
		process.exit(1)
	}
}

main().catch((err: Error) => {
	warn(err.message)
	process.exit(1)
})
