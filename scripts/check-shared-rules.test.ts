import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')
const sharedRulesDir = join(rootDir, 'src', 'shared')

const SUPPORTED_LANGUAGES = ['rust', 'typescript'] as const

interface RuleInfo {
	filename: string
	id: string
}

function getRulesForLanguage(language: string): RuleInfo[] {
	const langDir = join(sharedRulesDir, language)
	try {
		const files = readdirSync(langDir).filter((f) => f.endsWith('.yml'))
		return files.map((filename) => {
			const content = readFileSync(join(langDir, filename), 'utf-8')
			const idMatch = content.match(/^id:\s*(.+)$/m)
			return {
				filename,
				id: idMatch?.[1]?.trim() ?? filename.replace('.yml', ''),
			}
		})
	} catch {
		return []
	}
}

describe('shared rules', () => {
	const rulesByLanguage = new Map<string, RuleInfo[]>()

	for (const lang of SUPPORTED_LANGUAGES) {
		rulesByLanguage.set(lang, getRulesForLanguage(lang))
	}

	// Get union of all rule filenames
	const allFilenames = new Set<string>()
	for (const rules of rulesByLanguage.values()) {
		for (const rule of rules) {
			allFilenames.add(rule.filename)
		}
	}

	it('should have at least one shared rule', () => {
		expect(allFilenames.size).toBeGreaterThan(0)
	})

	for (const filename of allFilenames) {
		describe(filename, () => {
			for (const lang of SUPPORTED_LANGUAGES) {
				it(`should exist in ${lang}`, () => {
					const rules = rulesByLanguage.get(lang) ?? []
					const rule = rules.find((r) => r.filename === filename)
					expect(rule).toBeDefined()
				})
			}

			it('should have matching rule IDs across all languages', () => {
				const ruleIds = new Map<string, string>()

				for (const lang of SUPPORTED_LANGUAGES) {
					const rules = rulesByLanguage.get(lang) ?? []
					const rule = rules.find((r) => r.filename === filename)
					if (rule) {
						ruleIds.set(lang, rule.id)
					}
				}

				const uniqueIds = new Set(ruleIds.values())
				expect(uniqueIds.size).toBe(1)
			})
		})
	}
})
