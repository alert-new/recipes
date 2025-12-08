import { describe, it, expect } from 'vitest'
import {
	recipes,
	allRecipes,
	getRecipeBySlug,
	getRecipeForUrl,
	genericRecipe,
} from './index'

describe('recipes', () => {
	it('exports 8 site-specific recipes', () => {
		expect(recipes.length).toBe(8)
	})

	it('exports 9 total recipes including generic', () => {
		expect(allRecipes.length).toBe(9)
	})

	it('all recipes have required metadata', () => {
		for (const recipe of allRecipes) {
			expect(recipe.meta.slug).toBeDefined()
			expect(recipe.meta.name).toBeDefined()
			expect(recipe.meta.description).toBeDefined()
			expect(recipe.meta.category).toBeDefined()
			expect(recipe.meta.icon).toBeDefined()
			expect(recipe.meta.maintainers.length).toBeGreaterThan(0)
		}
	})

	it('all recipes have match pattern', () => {
		for (const recipe of allRecipes) {
			expect(recipe.match).toBeDefined()
		}
	})

	it('all recipes have fields', () => {
		for (const recipe of allRecipes) {
			expect(Object.keys(recipe.fields).length).toBeGreaterThan(0)
		}
	})

	it('all recipes have extract function', () => {
		for (const recipe of allRecipes) {
			expect(typeof recipe.extract).toBe('function')
		}
	})
})

describe('getRecipeBySlug', () => {
	it('returns recipe by slug', () => {
		const github = getRecipeBySlug('github')
		expect(github).toBeDefined()
		expect(github?.meta.slug).toBe('github')
	})

	it('returns undefined for unknown slug', () => {
		const unknown = getRecipeBySlug('unknown-recipe')
		expect(unknown).toBeUndefined()
	})
})

describe('getRecipeForUrl', () => {
	it('matches GitHub URLs', () => {
		const recipe = getRecipeForUrl('https://github.com/facebook/react')
		expect(recipe.meta.slug).toBe('github')
	})

	it('matches Amazon URLs', () => {
		const recipe = getRecipeForUrl('https://www.amazon.com/dp/B08N5WRWNW')
		expect(recipe.meta.slug).toBe('amazon')
	})

	it('matches YouTube URLs', () => {
		const recipe = getRecipeForUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
		expect(recipe.meta.slug).toBe('youtube')
	})

	it('matches Twitter/X URLs', () => {
		expect(getRecipeForUrl('https://x.com/user/status/123').meta.slug).toBe('twitter')
		expect(getRecipeForUrl('https://twitter.com/user/status/123').meta.slug).toBe('twitter')
	})

	it('returns generic for unknown URLs', () => {
		const recipe = getRecipeForUrl('https://example.com/random')
		expect(recipe.meta.slug).toBe('generic')
	})
})

describe('extract functions', () => {
	it('amazon extracts price and title', async () => {
		const amazon = getRecipeBySlug('amazon')
		const html = `
			<span id="productTitle">  Test Product  </span>
			<span class="a-price-whole">99</span>
			<span class="a-price-fraction">99</span>
			<span class="a-color-success">In Stock</span>
		`
		const data = await amazon!.extract(html, 'https://amazon.com/dp/test')
		expect(data.title).toBe('Test Product')
		expect(data.price).toBe(99.99)
		expect(data.inStock).toBe(true)
	})

	it('github extracts repo info', async () => {
		const github = getRecipeBySlug('github')
		const html = `
			<meta property="og:description" content="A JavaScript library">
		`
		const data = await github!.extract(html, 'https://github.com/facebook/react')
		expect(data.title).toBe('facebook/react')
		expect(data.description).toBe('A JavaScript library')
	})

	it('generic extracts basic metadata', async () => {
		const html = `
			<title>Test Page</title>
			<meta name="description" content="A test page">
			<meta name="author" content="Test Author">
		`
		const data = await genericRecipe.extract(html, 'https://example.com')
		expect(data.title).toBe('Test Page')
		expect(data.description).toBe('A test page')
		expect(data.author).toBe('Test Author')
	})
})

describe('transformUrl', () => {
	it('reddit transforms to JSON URL', () => {
		const reddit = getRecipeBySlug('reddit')
		const transformed = reddit?.transformUrl?.('https://www.reddit.com/r/programming/comments/abc/test/')
		expect(transformed).toBe('https://www.reddit.com/r/programming/comments/abc/test.json')
	})

	it('npm transforms to registry URL', () => {
		const npm = getRecipeBySlug('npm')
		const transformed = npm?.transformUrl?.('https://www.npmjs.com/package/react')
		expect(transformed).toBe('https://registry.npmjs.org/react')
	})
})

describe('defaultAlerts', () => {
	it('all alerts have required fields', () => {
		for (const recipe of recipes) {
			if (recipe.defaultAlerts) {
				for (const alert of recipe.defaultAlerts) {
					expect(alert.id).toBeDefined()
					expect(alert.label).toBeDefined()
					expect(alert.when).toBeDefined()
				}
			}
		}
	})
})
