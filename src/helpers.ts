/**
 * Shared helper functions for recipe extraction
 */

/**
 * Extract meta tags from HTML
 */
export function extractMetaTags(html: string): Record<string, string> {
	const meta: Record<string, string> = {}

	// Extract <title>
	const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
	if (titleMatch) {
		meta.title = titleMatch[1].trim()
	}

	// Extract meta tags (name/property before content)
	const metaRegex =
		/<meta\s+(?:[^>]*?\s+)?(?:name|property)=["']([^"']+)["'][^>]*?\s+content=["']([^"']+)["']/gi
	let match
	while ((match = metaRegex.exec(html)) !== null) {
		meta[match[1].toLowerCase()] = match[2]
	}

	// Also check reversed order (content before name)
	const metaRegex2 =
		/<meta\s+(?:[^>]*?\s+)?content=["']([^"']+)["'][^>]*?\s+(?:name|property)=["']([^"']+)["']/gi
	while ((match = metaRegex2.exec(html)) !== null) {
		meta[match[2].toLowerCase()] = match[1]
	}

	return meta
}

/**
 * Extract JSON-LD structured data from HTML
 */
export function extractJsonLd(html: string): any[] {
	const results: any[] = []
	const jsonLdRegex =
		/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
	let match

	while ((match = jsonLdRegex.exec(html)) !== null) {
		try {
			const json = JSON.parse(match[1])
			if (Array.isArray(json)) {
				results.push(...json)
			} else {
				results.push(json)
			}
		} catch {
			// Ignore invalid JSON
		}
	}

	return results
}

/**
 * Parse price string to number
 */
export function parsePrice(priceStr: string | undefined | null): number | undefined {
	if (!priceStr) return undefined
	const cleaned = priceStr.replace(/[^0-9.,]/g, '').replace(',', '.')
	const price = parseFloat(cleaned)
	return isNaN(price) ? undefined : price
}

/**
 * Extract first matching regex group
 */
export function extractFirst(html: string, regex: RegExp): string | undefined {
	const match = html.match(regex)
	return match?.[1]?.trim()
}

/**
 * Extract all matching regex groups
 */
export function extractAll(html: string, regex: RegExp): string[] {
	const results: string[] = []
	const globalRegex = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g')
	let match
	while ((match = globalRegex.exec(html)) !== null) {
		if (match[1]) results.push(match[1].trim())
	}
	return results
}

/**
 * Decode HTML entities
 */
export function decodeHtmlEntities(text: string): string {
	const entities: Record<string, string> = {
		'&amp;': '&',
		'&lt;': '<',
		'&gt;': '>',
		'&quot;': '"',
		'&#39;': "'",
		'&nbsp;': ' ',
	}
	return text.replace(/&[a-z]+;|&#\d+;/gi, (match) => {
		if (entities[match]) return entities[match]
		if (match.startsWith('&#')) {
			const code = parseInt(match.slice(2, -1), 10)
			return String.fromCharCode(code)
		}
		return match
	})
}

/**
 * Parse abbreviated numbers (e.g., "1.2k", "45.6k", "1.2M")
 */
export function parseAbbreviatedNumber(str: string): number {
	const cleaned = str.toLowerCase().trim()
	if (cleaned.endsWith('k')) {
		return Math.round(parseFloat(cleaned.replace('k', '')) * 1000)
	}
	if (cleaned.endsWith('m')) {
		return Math.round(parseFloat(cleaned.replace('m', '')) * 1000000)
	}
	if (cleaned.endsWith('b')) {
		return Math.round(parseFloat(cleaned.replace('b', '')) * 1000000000)
	}
	return parseInt(cleaned.replace(/[,.\s]/g, ''), 10) || 0
}

/**
 * Clean whitespace from text
 */
export function cleanText(text: string): string {
	return text.replace(/\s+/g, ' ').trim()
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
	try {
		return new URL(url).hostname.replace('www.', '')
	} catch {
		return ''
	}
}
