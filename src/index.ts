// Types
export * from './types'

// Helpers for recipe authors
export * from './helpers'

// Validation utilities
export * from './validate'

// All recipes
export { amazonRecipe } from './recipes/amazon'
export { ebayRecipe } from './recipes/ebay'
export { githubRecipe } from './recipes/github'
export { hackernewsRecipe } from './recipes/hackernews'
export { npmRecipe } from './recipes/npm'
export { redditRecipe } from './recipes/reddit'
export { twitterRecipe } from './recipes/twitter'
export { youtubeRecipe } from './recipes/youtube'
export { genericRecipe } from './recipes/generic'

import type { Recipe } from './types'
import { amazonRecipe } from './recipes/amazon'
import { ebayRecipe } from './recipes/ebay'
import { githubRecipe } from './recipes/github'
import { hackernewsRecipe } from './recipes/hackernews'
import { npmRecipe } from './recipes/npm'
import { redditRecipe } from './recipes/reddit'
import { twitterRecipe } from './recipes/twitter'
import { youtubeRecipe } from './recipes/youtube'
import { genericRecipe } from './recipes/generic'

/**
 * All available recipes (excluding generic)
 */
export const recipes: Recipe[] = [
	// E-commerce
	amazonRecipe,
	ebayRecipe,
	// Developer
	githubRecipe,
	npmRecipe,
	// Social
	redditRecipe,
	twitterRecipe,
	youtubeRecipe,
	// News
	hackernewsRecipe,
]

/**
 * All recipes including generic fallback
 */
export const allRecipes: Recipe[] = [...recipes, genericRecipe]

/**
 * Get recipe by slug
 */
export function getRecipeBySlug(slug: string): Recipe | undefined {
	return allRecipes.find((r) => r.meta.slug === slug)
}

/**
 * Get recipe for a URL
 */
export function getRecipeForUrl(url: string): Recipe {
	for (const recipe of recipes) {
		if (recipe.match instanceof RegExp) {
			if (recipe.match.test(url)) {
				return recipe
			}
		} else if (typeof recipe.match === 'function') {
			if (recipe.match(url)) {
				return recipe
			}
		}
	}
	return genericRecipe
}

/**
 * Client-safe example with metadata
 */
export interface ClientRecipeExample {
	url: string
	title: string
	subtitle?: string
	image?: string
}

/**
 * Client-safe recipe data (no functions, serializable)
 * Use this to send recipe data to the browser
 */
export interface ClientRecipe {
	slug: string
	name: string
	description: string
	icon: string
	category: string
	tags: string[]
	/** Rich examples with titles and metadata */
	richExamples: ClientRecipeExample[]
	/** Regex source string for URL matching */
	matchPattern: string | null
	fields: Array<{
		key: string
		label: string
		type: string
		primary: boolean
	}>
	defaultAlerts: Array<{
		id: string
		label: string
		description: string
		when: string
		icon?: string
	}>
}

/**
 * Convert a recipe to client-safe format
 */
export function toClientRecipe(recipe: Recipe): ClientRecipe {
	return {
		slug: recipe.meta.slug,
		name: recipe.meta.name,
		description: recipe.meta.description,
		icon: recipe.meta.icon,
		category: recipe.meta.category,
		tags: recipe.meta.tags || [],
		richExamples: recipe.meta.richExamples.map((ex) => ({
			url: ex.url,
			title: ex.title,
			subtitle: ex.subtitle,
			image: ex.image,
		})),
		matchPattern: recipe.match instanceof RegExp ? recipe.match.source : null,
		fields: Object.entries(recipe.fields).map(([key, field]) => ({
			key,
			label: field.label,
			type: field.type,
			primary: field.primary || false,
		})),
		defaultAlerts: (recipe.defaultAlerts || []).map((a) => ({
			id: a.id,
			label: a.label,
			description: a.description,
			when: a.when,
			icon: a.icon,
		})),
	}
}

/**
 * Get all recipes in client-safe format
 */
export function getClientRecipes(): ClientRecipe[] {
	return recipes.map(toClientRecipe)
}

/**
 * Get client-safe generic recipe
 */
export function getClientGenericRecipe(): ClientRecipe {
	return toClientRecipe(genericRecipe)
}
