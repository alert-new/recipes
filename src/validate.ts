import type { Recipe, RecipeCategory } from './types'
import { RECIPE_CATEGORIES } from './types'

const VALID_CATEGORIES = Object.keys(RECIPE_CATEGORIES) as RecipeCategory[]

export interface ValidationError {
	recipe: string
	field: string
	message: string
	severity: 'error' | 'warning'
}

export interface ValidationResult {
	valid: boolean
	errors: ValidationError[]
	warnings: ValidationError[]
}

/**
 * Validates a single recipe for completeness and correctness
 */
export function validateRecipe(recipe: Recipe): ValidationResult {
	const errors: ValidationError[] = []
	const warnings: ValidationError[] = []
	const slug = recipe.meta?.slug || 'unknown'

	const addError = (field: string, message: string) => {
		errors.push({ recipe: slug, field, message, severity: 'error' })
	}

	const addWarning = (field: string, message: string) => {
		warnings.push({ recipe: slug, field, message, severity: 'warning' })
	}

	// Required meta fields
	if (!recipe.meta) {
		addError('meta', 'Recipe must have meta object')
		return { valid: false, errors, warnings }
	}

	if (!recipe.meta.slug) {
		addError('meta.slug', 'Recipe must have a slug')
	} else if (!/^[a-z0-9-]+$/.test(recipe.meta.slug)) {
		addError('meta.slug', 'Slug must be lowercase alphanumeric with hyphens only')
	}

	if (!recipe.meta.name) {
		addError('meta.name', 'Recipe must have a name')
	} else if (recipe.meta.name.length > 50) {
		addWarning('meta.name', 'Name should be under 50 characters')
	}

	if (!recipe.meta.description) {
		addError('meta.description', 'Recipe must have a description')
	} else if (recipe.meta.description.length < 20) {
		addWarning('meta.description', 'Description should be at least 20 characters')
	} else if (recipe.meta.description.length > 200) {
		addWarning('meta.description', 'Description should be under 200 characters')
	}

	if (!recipe.meta.icon) {
		addError('meta.icon', 'Recipe must have an icon')
	}

	if (!recipe.meta.category) {
		addError('meta.category', 'Recipe must have a category')
	} else if (!VALID_CATEGORIES.includes(recipe.meta.category)) {
		addError('meta.category', `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`)
	}

	if (!recipe.meta.maintainers || recipe.meta.maintainers.length === 0) {
		addError('meta.maintainers', 'Recipe must have at least one maintainer')
	}

	if (!recipe.meta.tags || recipe.meta.tags.length === 0) {
		addWarning('meta.tags', 'Recipe should have at least one tag for discoverability')
	}

	// Match pattern validation
	if (!recipe.match) {
		addError('match', 'Recipe must have a match pattern')
	} else if (recipe.match instanceof RegExp) {
		// Test that regex is valid by testing against a dummy URL
		try {
			recipe.match.test('https://example.com')
		} catch {
			addError('match', 'Invalid regex pattern')
		}
	} else if (typeof recipe.match !== 'function') {
		addError('match', 'Match must be a RegExp or function')
	}

	// Fields validation
	if (!recipe.fields || Object.keys(recipe.fields).length === 0) {
		addError('fields', 'Recipe must have at least one field')
	} else {
		let hasPrimary = false
		for (const [fieldName, field] of Object.entries(recipe.fields)) {
			if (!field.type) {
				addError(`fields.${fieldName}`, 'Field must have a type')
			}
			if (!field.label) {
				addError(`fields.${fieldName}`, 'Field must have a label')
			}
			if (field.primary) {
				hasPrimary = true
			}
		}
		if (!hasPrimary) {
			addWarning('fields', 'Recipe should have at least one primary field')
		}
	}

	// Extract function validation
	if (!recipe.extract) {
		addError('extract', 'Recipe must have an extract function')
	} else if (typeof recipe.extract !== 'function') {
		addError('extract', 'Extract must be a function')
	}

	// Default alerts validation
	if (recipe.defaultAlerts) {
		const alertIds = new Set<string>()
		for (const alert of recipe.defaultAlerts) {
			if (!alert.id) {
				addError('defaultAlerts', 'Alert must have an id')
			} else if (alertIds.has(alert.id)) {
				addError('defaultAlerts', `Duplicate alert id: ${alert.id}`)
			} else {
				alertIds.add(alert.id)
			}

			if (!alert.label) {
				addError('defaultAlerts', `Alert ${alert.id} must have a label`)
			}
			if (!alert.when) {
				addError('defaultAlerts', `Alert ${alert.id} must have a when condition`)
			}
		}
	} else {
		addWarning('defaultAlerts', 'Recipe should have at least one default alert')
	}

	// Rich examples validation
	if (recipe.meta.richExamples && recipe.meta.richExamples.length > 0) {
		for (const example of recipe.meta.richExamples) {
			try {
				new URL(example.url)
			} catch {
				addError('meta.richExamples', `Invalid example URL: ${example.url}`)
			}

			if (!example.title || example.title.trim().length === 0) {
				addError('meta.richExamples', `Example missing title for URL: ${example.url}`)
			}

			// Check that example matches the recipe's pattern
			if (recipe.match) {
				let matches = false
				if (recipe.match instanceof RegExp) {
					matches = recipe.match.test(example.url)
				} else if (typeof recipe.match === 'function') {
					matches = recipe.match(example.url)
				}
				if (!matches) {
					addError('meta.richExamples', `Example URL does not match recipe pattern: ${example.url}`)
				}
			}
		}
	} else {
		addWarning('meta.richExamples', 'Recipe should have rich examples for better UX')
	}

	return {
		valid: errors.length === 0,
		errors,
		warnings,
	}
}

/**
 * Validates all recipes and checks for cross-recipe issues
 */
export function validateAllRecipes(recipes: Recipe[]): ValidationResult {
	const allErrors: ValidationError[] = []
	const allWarnings: ValidationError[] = []

	// Validate each recipe individually
	for (const recipe of recipes) {
		const result = validateRecipe(recipe)
		allErrors.push(...result.errors)
		allWarnings.push(...result.warnings)
	}

	// Check for duplicate slugs
	const slugs = new Map<string, number>()
	for (const recipe of recipes) {
		const slug = recipe.meta?.slug
		if (slug) {
			slugs.set(slug, (slugs.get(slug) || 0) + 1)
		}
	}
	for (const [slug, count] of slugs) {
		if (count > 1) {
			allErrors.push({
				recipe: slug,
				field: 'meta.slug',
				message: `Duplicate slug found ${count} times`,
				severity: 'error',
			})
		}
	}

	// Check for overlapping match patterns
	for (let i = 0; i < recipes.length; i++) {
		for (let j = i + 1; j < recipes.length; j++) {
			const r1 = recipes[i]
			const r2 = recipes[j]

			// Skip generic recipe
			if (r1.meta.slug === 'generic' || r2.meta.slug === 'generic') continue

			// Test r1's examples against r2's pattern
			if (r1.meta.richExamples) {
				for (const example of r1.meta.richExamples) {
					let matchesR2 = false
					if (r2.match instanceof RegExp) {
						matchesR2 = r2.match.test(example.url)
					} else if (typeof r2.match === 'function') {
						matchesR2 = r2.match(example.url)
					}
					if (matchesR2) {
						allWarnings.push({
							recipe: r1.meta.slug,
							field: 'match',
							message: `Example "${example.url}" also matches ${r2.meta.slug} recipe`,
							severity: 'warning',
						})
					}
				}
			}
		}
	}

	return {
		valid: allErrors.length === 0,
		errors: allErrors,
		warnings: allWarnings,
	}
}

/**
 * Tests that extract function works without crashing
 */
export async function testExtractFunction(
	recipe: Recipe,
	html: string,
	url: string
): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
	try {
		const data = await recipe.extract(html, url)

		// Verify returned data is an object
		if (typeof data !== 'object' || data === null) {
			return { success: false, error: 'Extract must return an object' }
		}

		// Verify no undefined values (should be omitted instead)
		for (const [key, value] of Object.entries(data)) {
			if (value === undefined) {
				return { success: false, error: `Field ${key} is undefined (should be omitted)` }
			}
		}

		return { success: true, data }
	} catch (err) {
		return {
			success: false,
			error: err instanceof Error ? err.message : 'Unknown error',
		}
	}
}
