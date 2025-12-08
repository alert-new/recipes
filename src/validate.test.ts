import { describe, it, expect } from 'vitest'
import { validateRecipe, validateAllRecipes, testExtractFunction } from './validate'
import { allRecipes, genericRecipe } from './index'
import type { Recipe } from './types'

describe('validateRecipe', () => {
	it('returns valid for a complete recipe', () => {
		const result = validateRecipe(genericRecipe)
		expect(result.valid).toBe(true)
		expect(result.errors).toHaveLength(0)
	})

	it('catches missing slug', () => {
		const badRecipe = {
			meta: { name: 'Test', description: 'Test desc', icon: '🔥', category: 'other', maintainers: ['test'] },
			match: /test/,
			fields: { title: { type: 'string', label: 'Title' } },
			extract: async () => ({}),
		} as unknown as Recipe

		const result = validateRecipe(badRecipe)
		expect(result.valid).toBe(false)
		expect(result.errors.some((e) => e.field === 'meta.slug')).toBe(true)
	})

	it('catches invalid slug format', () => {
		const badRecipe = {
			meta: {
				slug: 'Invalid Slug!',
				name: 'Test',
				description: 'Test desc',
				icon: '🔥',
				category: 'other',
				maintainers: ['test'],
			},
			match: /test/,
			fields: { title: { type: 'string', label: 'Title' } },
			extract: async () => ({}),
		} as unknown as Recipe

		const result = validateRecipe(badRecipe)
		expect(result.valid).toBe(false)
		expect(result.errors.some((e) => e.message.includes('lowercase'))).toBe(true)
	})

	it('catches missing fields', () => {
		const badRecipe = {
			meta: {
				slug: 'test',
				name: 'Test',
				description: 'Test desc',
				icon: '🔥',
				category: 'other',
				maintainers: ['test'],
			},
			match: /test/,
			fields: {},
			extract: async () => ({}),
		} as unknown as Recipe

		const result = validateRecipe(badRecipe)
		expect(result.valid).toBe(false)
		expect(result.errors.some((e) => e.field === 'fields')).toBe(true)
	})

	it('catches invalid category', () => {
		const badRecipe = {
			meta: {
				slug: 'test',
				name: 'Test',
				description: 'Test desc',
				icon: '🔥',
				category: 'invalid-category' as any,
				maintainers: ['test'],
			},
			match: /test/,
			fields: { title: { type: 'string', label: 'Title' } },
			extract: async () => ({}),
		} as unknown as Recipe

		const result = validateRecipe(badRecipe)
		expect(result.valid).toBe(false)
		expect(result.errors.some((e) => e.field === 'meta.category')).toBe(true)
	})

	it('catches invalid example URLs', () => {
		const badRecipe = {
			meta: {
				slug: 'test',
				name: 'Test',
				description: 'Test desc',
				icon: '🔥',
				category: 'other',
				maintainers: ['test'],
				richExamples: [{ url: 'not-a-valid-url', title: 'Bad URL' }],
			},
			match: /test/,
			fields: { title: { type: 'string', label: 'Title' } },
			extract: async () => ({}),
		} as unknown as Recipe

		const result = validateRecipe(badRecipe)
		expect(result.valid).toBe(false)
		expect(result.errors.some((e) => e.message.includes('Invalid example URL'))).toBe(true)
	})

	it('catches example URLs that do not match pattern', () => {
		const badRecipe = {
			meta: {
				slug: 'test',
				name: 'Test',
				description: 'Test desc',
				icon: '🔥',
				category: 'other',
				maintainers: ['test'],
				richExamples: [{ url: 'https://example.com/test', title: 'Example' }],
			},
			match: /github\.com/,
			fields: { title: { type: 'string', label: 'Title' } },
			extract: async () => ({}),
		} as unknown as Recipe

		const result = validateRecipe(badRecipe)
		expect(result.valid).toBe(false)
		expect(result.errors.some((e) => e.message.includes('does not match'))).toBe(true)
	})

	it('warns about missing primary field', () => {
		const recipe = {
			meta: {
				slug: 'test',
				name: 'Test',
				description: 'Test desc test test test',
				icon: '🔥',
				category: 'other',
				maintainers: ['test'],
			},
			match: /test/,
			fields: { title: { type: 'string', label: 'Title' } },
			extract: async () => ({}),
		} as unknown as Recipe

		const result = validateRecipe(recipe)
		expect(result.warnings.some((w) => w.message.includes('primary'))).toBe(true)
	})
})

describe('validateAllRecipes', () => {
	it('validates all bundled recipes successfully', () => {
		const result = validateAllRecipes(allRecipes)
		expect(result.valid).toBe(true)
		expect(result.errors).toHaveLength(0)
	})

	it('catches duplicate slugs', () => {
		const duplicates = [
			{ ...genericRecipe, meta: { ...genericRecipe.meta, slug: 'dupe' } },
			{ ...genericRecipe, meta: { ...genericRecipe.meta, slug: 'dupe' } },
		] as Recipe[]

		const result = validateAllRecipes(duplicates)
		expect(result.valid).toBe(false)
		expect(result.errors.some((e) => e.message.includes('Duplicate'))).toBe(true)
	})
})

describe('testExtractFunction', () => {
	it('returns success for working extract', async () => {
		const result = await testExtractFunction(genericRecipe, '<title>Test</title>', 'https://example.com')
		expect(result.success).toBe(true)
		expect(result.data).toBeDefined()
	})

	it('returns error for extract that throws', async () => {
		const badRecipe = {
			...genericRecipe,
			extract: async () => {
				throw new Error('Test error')
			},
		} as Recipe

		const result = await testExtractFunction(badRecipe, '<html></html>', 'https://example.com')
		expect(result.success).toBe(false)
		expect(result.error).toBe('Test error')
	})

	it('returns error for extract that returns non-object', async () => {
		const badRecipe = {
			...genericRecipe,
			extract: async () => null as any,
		} as Recipe

		const result = await testExtractFunction(badRecipe, '<html></html>', 'https://example.com')
		expect(result.success).toBe(false)
		expect(result.error).toContain('object')
	})
})
