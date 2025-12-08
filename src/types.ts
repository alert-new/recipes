/**
 * Extracted data from a webpage
 */
export type ExtractedData = Record<string, unknown>

/**
 * Recipe Field Definition
 * Describes a trackable field that the recipe extracts
 */
export interface RecipeField {
	/** Field type for formatting and comparison */
	type: 'string' | 'number' | 'boolean' | 'currency' | 'url' | 'date'
	/** Human-readable label */
	label: string
	/** Description of what this field represents */
	description?: string
	/** Is this a primary field shown by default? */
	primary?: boolean
	/** Should changes to this field be ignored? (noise filtering) */
	noise?: boolean
	/** Currency code for currency fields */
	currency?: string
}

/**
 * Default Alert Condition
 * Pre-configured alert triggers users can enable
 */
export interface DefaultAlert {
	/** Unique identifier for this alert type */
	id: string
	/** Human-readable label */
	label: string
	/** Description of when this triggers */
	description: string
	/** Condition expression (e.g., "price < previous.price") */
	when: string
	/** Icon for UI display */
	icon?: string
}

/**
 * Rich example with metadata for better UX
 */
export interface RecipeExample {
	/** The URL to track */
	url: string
	/** Human-readable title */
	title: string
	/** Optional subtitle (e.g., price, status) */
	subtitle?: string
	/** Optional image/logo URL */
	image?: string
}

/**
 * Recipe Metadata
 * Information about the recipe for catalog/discovery
 */
export interface RecipeMeta {
	/** Recipe slug (unique identifier) */
	slug: string
	/** Display name */
	name: string
	/** Short description */
	description: string
	/** Long description for recipe page */
	longDescription?: string
	/** Icon URL or emoji */
	icon: string
	/** Category slug */
	category: RecipeCategory
	/** Tags for search/filtering */
	tags?: string[]
	/** GitHub usernames of maintainers */
	maintainers: string[]
	/** When recipe was added */
	createdAt?: string
	/** Last update date */
	updatedAt?: string
	/** Rich examples with titles and metadata */
	richExamples: RecipeExample[]
}

/**
 * Recipe Definition
 * Complete recipe including metadata, matching, fields, and extraction
 */
export interface Recipe {
	/** Recipe metadata */
	meta: RecipeMeta

	/** URL matching - regex or function */
	match: RegExp | ((url: string) => boolean)

	/** Fields this recipe extracts */
	fields: Record<string, RecipeField>

	/** Pre-configured alert conditions */
	defaultAlerts?: DefaultAlert[]

	/** Extract data from HTML */
	extract: (html: string, url: string) => Promise<ExtractedData>

	/** Optional: Transform URL before fetching (e.g., to API endpoint) */
	transformUrl?: (url: string) => string

	/** Optional: Custom headers for fetch */
	headers?: Record<string, string>

	/** Optional: Requires JavaScript rendering */
	requiresJs?: boolean
}

/**
 * Helper to define a recipe with proper typing
 */
export function defineRecipe(recipe: Recipe): Recipe {
	return recipe
}

/**
 * Recipe Categories
 */
export const RECIPE_CATEGORIES = {
	ecommerce: {
		name: 'E-commerce',
		icon: '🛒',
		description: 'Price drops, stock alerts, and deal tracking',
	},
	developer: {
		name: 'Developer',
		icon: '💻',
		description: 'GitHub releases, package updates, and changelogs',
	},
	jobs: {
		name: 'Jobs',
		icon: '💼',
		description: 'Job postings and career page updates',
	},
	social: {
		name: 'Social',
		icon: '📱',
		description: 'Social media profiles and content',
	},
	news: {
		name: 'News',
		icon: '📰',
		description: 'News sites, blogs, and publications',
	},
	finance: {
		name: 'Finance',
		icon: '📈',
		description: 'Stock prices, SEC filings, and financial data',
	},
	status: {
		name: 'Status Pages',
		icon: '🟢',
		description: 'Service status and incident monitoring',
	},
	entertainment: {
		name: 'Entertainment',
		icon: '🎬',
		description: 'Movies, TV shows, games, and media',
	},
	travel: {
		name: 'Travel',
		icon: '✈️',
		description: 'Flight prices, hotel rates, and travel deals',
	},
	government: {
		name: 'Government',
		icon: '🏛️',
		description: 'Government sites, permits, and public data',
	},
	other: {
		name: 'Other',
		icon: '🌐',
		description: 'Miscellaneous websites',
	},
} as const

export type RecipeCategory = keyof typeof RECIPE_CATEGORIES
