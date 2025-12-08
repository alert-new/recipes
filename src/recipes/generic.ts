import { defineRecipe, type ExtractedData } from '../types'
import { extractMetaTags, extractJsonLd, decodeHtmlEntities, cleanText } from '../helpers'

export const genericRecipe = defineRecipe({
	meta: {
		slug: 'generic',
		name: 'Web Page',
		description: 'Monitor any web page for content changes',
		longDescription: `A generic recipe that works with any web page. Extracts metadata,
		main content, and tracks changes to the page structure. Use this as a fallback
		when no specific recipe exists for a website.`,
		icon: '🌐',
		category: 'other',
		tags: ['general', 'any', 'webpage'],
		maintainers: ['alertnew'],
		richExamples: [
			{
				url: 'https://www.apple.com/shop/buy-mac/macbook-pro',
				title: 'Apple MacBook Pro',
			},
			{
				url: 'https://www.tesla.com/model3',
				title: 'Tesla Model 3',
			},
		],
	},

	// Matches everything (fallback)
	match: () => true,

	fields: {
		title: {
			type: 'string',
			label: 'Page Title',
			primary: true,
		},
		description: {
			type: 'string',
			label: 'Description',
		},
		author: {
			type: 'string',
			label: 'Author',
		},
		lastModified: {
			type: 'date',
			label: 'Last Modified',
			noise: true,
		},
		mainContent: {
			type: 'string',
			label: 'Main Content',
			description: 'Extracted main text content',
		},
		wordCount: {
			type: 'number',
			label: 'Word Count',
			noise: true,
		},
	},

	defaultAlerts: [
		{
			id: 'content-change',
			label: 'Content Changed',
			description: 'Get notified when the page content changes',
			when: 'mainContent != previous.mainContent',
			icon: '📝',
		},
		{
			id: 'title-change',
			label: 'Title Changed',
			description: 'Get notified when the page title changes',
			when: 'title != previous.title',
			icon: '📄',
		},
	],

	async extract(html: string, url: string): Promise<ExtractedData> {
		const data: ExtractedData = {}

		// Extract meta tags
		const meta = extractMetaTags(html)

		// Title - prefer og:title, then twitter:title, then <title>
		data.title =
			meta['og:title'] || meta['twitter:title'] || meta.title || extractPageTitle(html)

		// Description
		data.description = meta['og:description'] || meta['twitter:description'] || meta.description

		// Author
		data.author = meta.author || meta['article:author'] || meta['og:article:author']

		// Try to extract from JSON-LD
		const jsonLd = extractJsonLd(html)
		for (const ld of jsonLd) {
			if (ld['@type'] === 'Article' || ld['@type'] === 'NewsArticle') {
				data.title = data.title || ld.headline
				data.description = data.description || ld.description
				data.author = data.author || ld.author?.name
				data.publishedDate = ld.datePublished
				data.modifiedDate = ld.dateModified
			}
			if (ld['@type'] === 'Product') {
				data.title = data.title || ld.name
				data.description = data.description || ld.description
				if (ld.offers) {
					data.price = parseFloat(ld.offers.price)
					data.currency = ld.offers.priceCurrency
					data.inStock = ld.offers.availability?.includes('InStock')
				}
			}
		}

		// Extract main content (simplified)
		const mainContent = extractMainContent(html)
		if (mainContent) {
			data.mainContent = mainContent
			data.wordCount = mainContent.split(/\s+/).filter(Boolean).length
		}

		// Clean up undefined values
		for (const key of Object.keys(data)) {
			if (data[key] === undefined) {
				delete data[key]
			}
		}

		return data
	},
})

function extractPageTitle(html: string): string | undefined {
	const match = html.match(/<title[^>]*>([^<]+)<\/title>/i)
	if (match) {
		return decodeHtmlEntities(match[1].trim())
	}
	return undefined
}

function extractMainContent(html: string): string | undefined {
	// Remove scripts and styles
	let content = html
		.replace(/<script[\s\S]*?<\/script>/gi, '')
		.replace(/<style[\s\S]*?<\/style>/gi, '')
		.replace(/<nav[\s\S]*?<\/nav>/gi, '')
		.replace(/<header[\s\S]*?<\/header>/gi, '')
		.replace(/<footer[\s\S]*?<\/footer>/gi, '')
		.replace(/<aside[\s\S]*?<\/aside>/gi, '')

	// Try to find main content area
	const mainPatterns = [
		/<main[^>]*>([\s\S]*?)<\/main>/i,
		/<article[^>]*>([\s\S]*?)<\/article>/i,
		/<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
		/<div[^>]*id="content"[^>]*>([\s\S]*?)<\/div>/i,
	]

	for (const pattern of mainPatterns) {
		const match = content.match(pattern)
		if (match) {
			content = match[1]
			break
		}
	}

	// Strip HTML tags
	content = content.replace(/<[^>]+>/g, ' ')

	// Clean up whitespace
	content = cleanText(content)

	// Limit length
	if (content.length > 5000) {
		content = content.substring(0, 5000) + '...'
	}

	return content || undefined
}
