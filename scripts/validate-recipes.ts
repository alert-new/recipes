#!/usr/bin/env npx tsx
/**
 * Recipe validation script
 * Run with: npx tsx scripts/validate-recipes.ts
 *
 * This script validates all recipes for:
 * - Required metadata fields
 * - Valid URL patterns
 * - Example URLs that match their patterns
 * - No duplicate slugs
 * - Extract functions that don't crash
 */

import { allRecipes } from '../src/index'
import { validateAllRecipes, testExtractFunction } from '../src/validate'

async function main() {
	console.log('🔍 Validating recipes...\n')

	// Run validation
	const result = validateAllRecipes(allRecipes)

	// Print errors
	if (result.errors.length > 0) {
		console.log('❌ ERRORS:\n')
		for (const error of result.errors) {
			console.log(`  [${error.recipe}] ${error.field}: ${error.message}`)
		}
		console.log()
	}

	// Print warnings
	if (result.warnings.length > 0) {
		console.log('⚠️  WARNINGS:\n')
		for (const warning of result.warnings) {
			console.log(`  [${warning.recipe}] ${warning.field}: ${warning.message}`)
		}
		console.log()
	}

	// Test extract functions with minimal HTML
	console.log('🧪 Testing extract functions...\n')
	const minimalHtml = '<html><head><title>Test</title></head><body></body></html>'

	for (const recipe of allRecipes) {
		const testUrl = recipe.meta.examples?.[0] || 'https://example.com'
		const result = await testExtractFunction(recipe, minimalHtml, testUrl)

		if (result.success) {
			console.log(`  ✓ ${recipe.meta.slug}`)
		} else {
			console.log(`  ✗ ${recipe.meta.slug}: ${result.error}`)
		}
	}

	console.log()

	// Summary
	console.log('━'.repeat(50))
	console.log(`📊 SUMMARY`)
	console.log(`   Recipes: ${allRecipes.length}`)
	console.log(`   Errors: ${result.errors.length}`)
	console.log(`   Warnings: ${result.warnings.length}`)
	console.log('━'.repeat(50))

	if (!result.valid) {
		console.log('\n❌ Validation failed. Please fix errors before merging.\n')
		process.exit(1)
	}

	console.log('\n✅ All recipes are valid!\n')
	process.exit(0)
}

main().catch((err) => {
	console.error('Validation script failed:', err)
	process.exit(1)
})
