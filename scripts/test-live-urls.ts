#!/usr/bin/env npx tsx
/**
 * Live URL testing script
 * Run with: npx tsx scripts/test-live-urls.ts [recipe-slug]
 *
 * Tests recipes against their real example URLs to verify extraction works.
 * This is optional and may fail due to network issues or page changes.
 */

import { allRecipes, getRecipeBySlug } from '../src/index'

const TIMEOUT = 10000

async function fetchWithTimeout(url: string, timeout: number): Promise<string> {
	const controller = new AbortController()
	const timeoutId = setTimeout(() => controller.abort(), timeout)

	try {
		const response = await fetch(url, {
			signal: controller.signal,
			headers: {
				'User-Agent':
					'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
				Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
			},
		})

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`)
		}

		return await response.text()
	} finally {
		clearTimeout(timeoutId)
	}
}

async function testRecipe(slug: string): Promise<boolean> {
	const recipe = getRecipeBySlug(slug)
	if (!recipe) {
		console.log(`  ❌ Recipe not found: ${slug}`)
		return false
	}

	const examples = recipe.meta.richExamples || []
	if (examples.length === 0) {
		console.log(`  ⚠️  ${slug}: No example URLs defined`)
		return true
	}

	let allPassed = true

	for (const example of examples) {
		const url = example.url
		try {
			// Use transformUrl if available
			const fetchUrl = recipe.transformUrl ? recipe.transformUrl(url) : url

			console.log(`  📡 ${slug}: Fetching ${fetchUrl.substring(0, 60)}...`)
			const html = await fetchWithTimeout(fetchUrl, TIMEOUT)

			console.log(`  🔍 ${slug}: Extracting data...`)
			const data = await recipe.extract(html, url)

			// Check if we got any data
			const fields = Object.keys(data).filter((k) => data[k] !== undefined)
			if (fields.length === 0) {
				console.log(`  ⚠️  ${slug}: No data extracted from ${url}`)
				allPassed = false
			} else {
				console.log(`  ✓ ${slug}: Extracted ${fields.length} fields: ${fields.join(', ')}`)

				// Show first few values
				for (const field of fields.slice(0, 3)) {
					const value = data[field]
					const display =
						typeof value === 'string'
							? value.substring(0, 50) + (value.length > 50 ? '...' : '')
							: JSON.stringify(value)
					console.log(`      ${field}: ${display}`)
				}
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Unknown error'
			console.log(`  ❌ ${slug}: ${url} - ${message}`)
			allPassed = false
		}
	}

	return allPassed
}

async function main() {
	const specificSlug = process.argv[2]

	console.log('🌐 Testing recipes against live URLs...\n')
	console.log('Note: This test may fail due to network issues or page changes.\n')

	let passed = 0
	let failed = 0

	const recipesToTest = specificSlug
		? [getRecipeBySlug(specificSlug)].filter(Boolean)
		: allRecipes.filter((r) => r.meta.slug !== 'generic')

	for (const recipe of recipesToTest) {
		if (!recipe) continue
		console.log(`\n📦 ${recipe.meta.name} (${recipe.meta.slug})`)

		const success = await testRecipe(recipe.meta.slug)
		if (success) {
			passed++
		} else {
			failed++
		}
	}

	console.log('\n' + '━'.repeat(50))
	console.log(`📊 LIVE TEST SUMMARY`)
	console.log(`   Passed: ${passed}`)
	console.log(`   Failed: ${failed}`)
	console.log('━'.repeat(50))

	// Don't fail CI on live tests - they're informational
	if (failed > 0) {
		console.log('\n⚠️  Some live tests failed. This may be due to network issues.')
		console.log('   Review failures manually before merging.\n')
	} else {
		console.log('\n✅ All live tests passed!\n')
	}
}

main().catch((err) => {
	console.error('Live test script failed:', err)
	process.exit(1)
})
