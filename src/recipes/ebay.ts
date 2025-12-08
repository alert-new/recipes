import { defineRecipe, type ExtractedData } from '../types'
import { extractFirst, parsePrice, decodeHtmlEntities, extractJsonLd, extractMetaTags } from '../helpers'

export const ebayRecipe = defineRecipe({
	meta: {
		slug: 'ebay',
		name: 'eBay Listing',
		description: 'Track prices, bids, and availability on eBay',
		longDescription: `Monitor eBay listings for price changes, bid activity, and stock updates.
			Perfect for tracking auctions, Buy It Now items, or watching for deals on specific products.
			Supports both auction and fixed-price listings across all eBay domains.`,
		icon: 'https://www.ebay.com/favicon.ico',
		category: 'ecommerce',
		tags: ['shopping', 'auctions', 'deals', 'marketplace'],
		maintainers: ['alertnew'],
		richExamples: [
			{
				url: 'https://www.ebay.com/itm/356852113226',
				title: 'Apple iPhone 15 Pro 256GB (Blue Titanium)',
			},
			{
				url: 'https://www.ebay.com/itm/126811822591',
				title: 'Sony PlayStation 5 Console',
			},
		],
	},

	match: /^https?:\/\/(www\.)?ebay\.(com|co\.uk|de|fr|ca|com\.au|it|es)\/itm\//i,

	fields: {
		title: {
			type: 'string',
			label: 'Item Title',
			primary: true,
		},
		price: {
			type: 'currency',
			label: 'Price',
			currency: 'USD',
			primary: true,
		},
		originalPrice: {
			type: 'currency',
			label: 'Original Price',
			description: 'Was price before discount',
		},
		discount: {
			type: 'string',
			label: 'Discount',
		},
		bidCount: {
			type: 'number',
			label: 'Bids',
			description: 'Number of bids (for auctions)',
		},
		currentBid: {
			type: 'currency',
			label: 'Current Bid',
		},
		timeLeft: {
			type: 'string',
			label: 'Time Left',
			description: 'Time remaining for auction',
			noise: true,
		},
		endTime: {
			type: 'date',
			label: 'End Time',
		},
		condition: {
			type: 'string',
			label: 'Condition',
		},
		seller: {
			type: 'string',
			label: 'Seller',
		},
		sellerRating: {
			type: 'number',
			label: 'Seller Rating %',
		},
		sellerFeedbackCount: {
			type: 'number',
			label: 'Seller Feedback Count',
		},
		quantity: {
			type: 'number',
			label: 'Available Quantity',
		},
		sold: {
			type: 'number',
			label: 'Sold Count',
			noise: true,
		},
		shippingPrice: {
			type: 'currency',
			label: 'Shipping',
			currency: 'USD',
		},
		freeReturns: {
			type: 'boolean',
			label: 'Free Returns',
		},
		returnPeriod: {
			type: 'string',
			label: 'Return Period',
		},
		isAuction: {
			type: 'boolean',
			label: 'Auction',
		},
		isBuyItNow: {
			type: 'boolean',
			label: 'Buy It Now Available',
		},
		watchers: {
			type: 'number',
			label: 'Watchers',
			noise: true,
		},
		itemId: {
			type: 'string',
			label: 'Item ID',
		},
		location: {
			type: 'string',
			label: 'Item Location',
		},
		brand: {
			type: 'string',
			label: 'Brand',
		},
		imageUrl: {
			type: 'url',
			label: 'Image',
			noise: true,
		},
	},

	defaultAlerts: [
		{
			id: 'price-drop',
			label: 'Price Drop',
			description: 'Get notified when the price decreases',
			when: 'price < previous.price',
			icon: '💰',
		},
		{
			id: 'new-bid',
			label: 'New Bid',
			description: 'Get notified when a new bid is placed',
			when: 'bidCount > previous.bidCount',
			icon: '🔨',
		},
		{
			id: 'ending-soon',
			label: 'Ending Soon',
			description: 'Get notified when auction is about to end',
			when: 'timeLeft.includes("hour") || timeLeft.includes("min")',
			icon: '⏰',
		},
		{
			id: 'low-stock',
			label: 'Low Stock',
			description: 'Get notified when only a few items remain',
			when: 'quantity <= 3 && quantity < previous.quantity',
			icon: '📉',
		},
		{
			id: 'price-threshold',
			label: 'Price Under Target',
			description: 'Get notified when price drops below target',
			when: 'price < $threshold',
			icon: '🎯',
		},
		{
			id: 'sold-out',
			label: 'Sold Out',
			description: 'Get notified when item sells out',
			when: 'quantity == 0 && previous.quantity > 0',
			icon: '❌',
		},
	],

	async extract(html: string, url: string): Promise<ExtractedData> {
		const data: ExtractedData = {}

		// Extract item ID from URL
		const itemIdMatch = url.match(/\/itm\/(\d+)/)
		if (itemIdMatch) {
			data.itemId = itemIdMatch[1]
		}

		// Try JSON-LD first (most reliable)
		const jsonLd = extractJsonLd(html)
		for (const ld of jsonLd) {
			if (ld['@type'] === 'Product') {
				data.title = ld.name
				data.brand = ld.brand?.name || ld.brand
				data.description = ld.description
				data.imageUrl = Array.isArray(ld.image) ? ld.image[0] : ld.image

				if (ld.offers) {
					const offers = Array.isArray(ld.offers) ? ld.offers[0] : ld.offers
					data.price = parseFloat(offers.price)
					data.currency = offers.priceCurrency
					if (offers.availability) {
						data.inStock = offers.availability.includes('InStock')
					}
					if (offers.itemCondition) {
						const conditionMap: Record<string, string> = {
							'NewCondition': 'New',
							'UsedCondition': 'Used',
							'RefurbishedCondition': 'Refurbished',
						}
						const condMatch = offers.itemCondition.match(/(\w+)Condition/)
						if (condMatch) {
							data.condition = conditionMap[condMatch[1] + 'Condition'] || condMatch[1]
						}
					}
				}
			}
		}

		// Meta tags fallback
		const meta = extractMetaTags(html)
		if (!data.title) {
			data.title = meta['og:title']
		}
		if (!data.imageUrl) {
			data.imageUrl = meta['og:image']
		}

		// Title fallback from HTML
		if (!data.title) {
			const titlePatterns = [
				/<h1[^>]*class="[^"]*x-item-title[^"]*"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/i,
				/<h1[^>]*id="itemTitle"[^>]*>([^<]+)</i,
				/<span[^>]*class="[^"]*vi-title[^"]*"[^>]*>([^<]+)<\/span>/i,
			]
			for (const pattern of titlePatterns) {
				const match = extractFirst(html, pattern)
				if (match) {
					data.title = decodeHtmlEntities(match.trim())
					break
				}
			}
		}

		// Price extraction - multiple patterns
		const pricePatterns = [
			/<span[^>]*class="[^"]*x-price-primary[^"]*"[^>]*>[\s\S]*?<span[^>]*>(?:US\s*)?\$([\d,]+\.?\d*)<\/span>/i,
			/<span[^>]*class="[^"]*ux-textspans--BOLD[^"]*"[^>]*>\s*(?:US\s*)?\$?([\d,]+\.?\d*)/i,
			/<span[^>]*id="prcIsum"[^>]*>(?:US\s*)?\$([\d,]+\.?\d*)<\/span>/i,
			/<span[^>]*itemprop="price"[^>]*>(?:US\s*)?\$([\d,]+\.?\d*)<\/span>/i,
		]

		if (!data.price) {
			for (const pattern of pricePatterns) {
				const match = extractFirst(html, pattern)
				if (match) {
					data.price = parsePrice(match)
					if (data.price) break
				}
			}
		}

		// Original/Was price
		const originalPatterns = [
			/Was:\s*(?:US\s*)?\$([\d,]+\.?\d*)/i,
			/<span[^>]*class="[^"]*x-price-was[^"]*"[^>]*>[\s\S]*?\$([\d,]+\.?\d*)/i,
			/<span[^>]*class="[^"]*ux-textspans--STRIKETHROUGH[^"]*"[^>]*>\$([\d,]+\.?\d*)/i,
		]
		for (const pattern of originalPatterns) {
			const match = extractFirst(html, pattern)
			if (match) {
				data.originalPrice = parsePrice(match)
				break
			}
		}

		// Discount
		const discountMatch = extractFirst(html, /(\d+%)\s*off/i)
		if (discountMatch) {
			data.discount = discountMatch
		}

		// Bid count and auction detection
		const bidMatch = extractFirst(html, /(\d+)\s*bids?/i)
		if (bidMatch) {
			data.bidCount = parseInt(bidMatch, 10)
			data.isAuction = true
		}

		// Current bid
		const currentBidMatch = extractFirst(html, /Current bid:?\s*(?:US\s*)?\$([\d,]+\.?\d*)/i)
		if (currentBidMatch) {
			data.currentBid = parsePrice(currentBidMatch)
			data.isAuction = true
		}

		// Buy It Now detection
		if (/Buy\s*It\s*Now/i.test(html)) {
			data.isBuyItNow = true
		}

		// Time left and end time
		const timePatterns = [
			/<span[^>]*class="[^"]*ux-timer[^"]*"[^>]*>([^<]+)<\/span>/i,
			/<span[^>]*id="vi-cdown_timeLeft"[^>]*>([^<]+)<\/span>/i,
		]
		for (const pattern of timePatterns) {
			const match = extractFirst(html, pattern)
			if (match) {
				data.timeLeft = decodeHtmlEntities(match.trim())
				break
			}
		}

		// End time (ISO format)
		const endTimeMatch = html.match(/data-end-time="([^"]+)"/i)
		if (endTimeMatch) {
			data.endTime = endTimeMatch[1]
		}

		// Condition
		if (!data.condition) {
			const conditionPatterns = [
				/<span[^>]*class="[^"]*ux-icon-text[^"]*"[^>]*>[\s\S]*?<span[^>]*>(New|Used|Open box|Refurbished|For parts|Pre-owned|Certified)[^<]*<\/span>/i,
				/<div[^>]*class="[^"]*x-item-condition[^"]*"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/i,
				/Condition:\s*<[^>]*>([^<]+)</i,
			]
			for (const pattern of conditionPatterns) {
				const match = extractFirst(html, pattern)
				if (match) {
					data.condition = match.trim()
					break
				}
			}
		}

		// Seller info
		const sellerPatterns = [
			/<span[^>]*class="[^"]*ux-seller-section__item--seller[^"]*"[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i,
			/<a[^>]*class="[^"]*mbg-id[^"]*"[^>]*>([^<]+)<\/a>/i,
			/Seller:\s*<[^>]*>([^<]+)</i,
		]
		for (const pattern of sellerPatterns) {
			const match = extractFirst(html, pattern)
			if (match) {
				data.seller = match.trim()
				break
			}
		}

		// Seller rating
		const ratingMatch = extractFirst(html, /([\d.]+)%\s*positive/i)
		if (ratingMatch) {
			data.sellerRating = parseFloat(ratingMatch)
		}

		// Seller feedback count
		const feedbackMatch = extractFirst(html, /\(([\d,]+)\)\s*(?:feedback|reviews)/i)
		if (feedbackMatch) {
			data.sellerFeedbackCount = parseInt(feedbackMatch.replace(/,/g, ''), 10)
		}

		// Quantity available
		const qtyPatterns = [
			/(\d+)\s*available/i,
			/Quantity:\s*(\d+)/i,
			/More than\s*(\d+)\s*available/i,
		]
		for (const pattern of qtyPatterns) {
			const match = extractFirst(html, pattern)
			if (match) {
				data.quantity = parseInt(match, 10)
				break
			}
		}

		// Sold count
		const soldMatch = extractFirst(html, /(\d+)\s*sold/i)
		if (soldMatch) {
			data.sold = parseInt(soldMatch, 10)
		}

		// Watchers
		const watchersMatch = extractFirst(html, /(\d+)\s*watchers?/i)
		if (watchersMatch) {
			data.watchers = parseInt(watchersMatch, 10)
		}

		// Shipping
		const shippingPatterns = [
			/\$([\d.]+)\s*(?:shipping|delivery)/i,
			/<span[^>]*class="[^"]*ux-textspans--BOLD[^"]*"[^>]*>\$([\d.]+)<\/span>\s*(?:shipping|Shipping)/i,
		]
		for (const pattern of shippingPatterns) {
			const match = extractFirst(html, pattern)
			if (match) {
				data.shippingPrice = parseFloat(match)
				break
			}
		}
		if (data.shippingPrice === undefined && /free\s*(?:shipping|delivery)/i.test(html)) {
			data.shippingPrice = 0
		}

		// Free returns
		data.freeReturns = /free\s*returns?/i.test(html)

		// Return period
		const returnMatch = extractFirst(html, /(\d+)\s*days?\s*returns?/i)
		if (returnMatch) {
			data.returnPeriod = `${returnMatch} days`
		}

		// Location
		const locationPatterns = [
			/Located in:\s*<[^>]*>([^<]+)</i,
			/Item location:\s*([^<,]+)/i,
			/<span[^>]*class="[^"]*ux-textspans[^"]*"[^>]*>([^<]+,\s*[A-Z]{2})<\/span>/i,
		]
		for (const pattern of locationPatterns) {
			const match = extractFirst(html, pattern)
			if (match) {
				data.location = decodeHtmlEntities(match.trim())
				break
			}
		}

		// Brand from specifics
		if (!data.brand) {
			const brandMatch = extractFirst(html, /Brand:\s*<[^>]*>([^<]+)</i)
			if (brandMatch) {
				data.brand = brandMatch.trim()
			}
		}

		return data
	},
})
