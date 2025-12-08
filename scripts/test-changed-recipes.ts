#!/usr/bin/env npx tsx
/**
 * Tests only recipes that have changed in the current PR/commit
 * This runs against live URLs and is a required CI check
 *
 * Usage:
 *   npx tsx scripts/test-changed-recipes.ts          # Test changed files vs main
 *   npx tsx scripts/test-changed-recipes.ts --all    # Test all recipes
 */

import { execSync } from 'child_process'
import { allRecipes, getRecipeBySlug } from '../src/index'

const TIMEOUT = 15000
const MAX_RETRIES = 2
const RETRY_DELAY = 2000

async function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchWithRetry(url: string, retries = MAX_RETRIES): Promise<string> {
	const controller = new AbortController()
	const timeoutId = setTimeout(() => controller.abort(), TIMEOUT)

	try {
		const response = await fetch(url, {
			signal: controller.signal,
			headers: {
				'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
				'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
				'Accept-Language': 'en-US,en;q=0.9',
			},
		})

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`)
		}

		return await response.text()
	} catch (err) {
		if (retries > 0) {
			console.log(`    Retrying in ${RETRY_DELAY/1000}s... (${retries} retries left)`)
			await sleep(RETRY_DELAY)
			return fetchWithRetry(url, retries - 1)
		}
		throw err
	} finally {
		clearTimeout(timeoutId)
	}
}

function getChangedRecipeSlugs(): string[] {
	try {
		// Get files changed compared to main/origin
		const bases = ['origin/main', 'main', 'HEAD~1']
		let changedFiles: string[] = []

		for (const base of bases) {
			try {
				const output = execSync(`git diff --name-only ${base}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] })
				changedFiles = output.trim().split('\n').filter(Boolean)
				if (changedFiles.length > 0) break
			} catch {
				continue
			}
		}

		// Extract recipe slugs from changed files
		const slugs: string[] = []
		for (const file of changedFiles) {
			const match = file.match(/src\/recipes\/([^/]+)\.ts$/)
			if (match) {
				const slug = match[1] === 'product-hunt' ? 'producthunt' : match[1]
				if (slug !== 'generic') {
					slugs.push(slug)
				}
			}
		}

		return [...new Set(slugs)]
	} catch {
		return []
	}
}

interface TestResult {
	slug: string
	success: boolean
	url: string
	fieldsExtracted: string[]
	error?: string
}

async function testRecipe(slug: string): Promise<TestResult | null> {
	const recipe = getRecipeBySlug(slug)
	if (!recipe) {
		return { slug, success: false, url: '', fieldsExtracted: [], error: 'Recipe not found' }
	}

	// Skip recipes that require JS rendering - we can't test those without a headless browser
	if (recipe.requiresJs) {
		console.log(`  ⏭️  Skipping (requires JS rendering)`)
		return null
	}

	const examples = recipe.meta.examples || []
	if (examples.length === 0) {
		return { slug, success: false, url: '', fieldsExtracted: [], error: 'No example URLs defined' }
	}

	// Test first example URL
	const url = examples[0]
	const fetchUrl = recipe.transformUrl ? recipe.transformUrl(url) : url

	try {
		console.log(`  Fetching: ${fetchUrl.substring(0, 70)}...`)
		const html = await fetchWithRetry(fetchUrl)

		console.log(`  Extracting data...`)
		const data = await recipe.extract(html, url)

		const fieldsExtracted = Object.keys(data).filter(k => data[k] !== undefined && data[k] !== null && data[k] !== '')

		if (fieldsExtracted.length === 0) {
			return { slug, success: false, url, fieldsExtracted: [], error: 'No data extracted' }
		}

		// Check if we got at least one primary field
		const primaryFields = Object.entries(recipe.fields)
			.filter(([_, field]) => field.primary)
			.map(([name]) => name)

		const hasPrimaryData = primaryFields.some(f => fieldsExtracted.includes(f))

		if (primaryFields.length > 0 && !hasPrimaryData) {
			return {
				slug,
				success: false,
				url,
				fieldsExtracted,
				error: `Missing primary fields. Expected one of: ${primaryFields.join(', ')}. Got: ${fieldsExtracted.join(', ')}`
			}
		}

		return { slug, success: true, url, fieldsExtracted }
	} catch (err) {
		return {
			slug,
			success: false,
			url,
			fieldsExtracted: [],
			error: err instanceof Error ? err.message : 'Unknown error'
		}
	}
}

async function main() {
	const testAll = process.argv.includes('--all')

	let slugsToTest: string[]

	if (testAll) {
		console.log('🧪 Testing ALL recipes against live URLs...\n')
		slugsToTest = allRecipes
			.filter(r => r.meta.slug !== 'generic')
			.map(r => r.meta.slug)
	} else {
		slugsToTest = getChangedRecipeSlugs()

		if (slugsToTest.length === 0) {
			console.log('✅ No recipe files changed - skipping live URL tests\n')
			process.exit(0)
		}

		console.log(`🧪 Testing ${slugsToTest.length} changed recipe(s) against live URLs...\n`)
	}

	const results: TestResult[] = []
	let skipped = 0

	for (const slug of slugsToTest) {
		console.log(`\n📦 ${slug}`)
		const result = await testRecipe(slug)

		if (result === null) {
			skipped++
			continue
		}

		results.push(result)

		if (result.success) {
			console.log(`  ✅ Extracted ${result.fieldsExtracted.length} fields: ${result.fieldsExtracted.join(', ')}`)
		} else {
			console.log(`  ❌ ${result.error}`)
		}
	}

	// Summary
	console.log('\n' + '━'.repeat(60))
	const passed = results.filter(r => r.success)
	const failed = results.filter(r => !r.success)

	console.log(`\n📊 RESULTS: ${passed.length}/${results.length} passed${skipped > 0 ? `, ${skipped} skipped (require JS)` : ''}\n`)

	if (failed.length > 0) {
		console.log('❌ FAILED:')
		for (const f of failed) {
			console.log(`   ${f.slug}: ${f.error}`)
		}
		console.log('\n')
		process.exit(1)
	}

	console.log('✅ All live URL tests passed!\n')
	process.exit(0)
}

main().catch(err => {
	console.error('Test script failed:', err)
	process.exit(1)
})
