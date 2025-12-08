import { defineRecipe, type ExtractedData } from '../types'
import { extractFirst, extractJsonLd, parsePrice, decodeHtmlEntities, extractMetaTags } from '../helpers'

export const amazonRecipe = defineRecipe({
	meta: {
		slug: 'amazon',
		name: 'Amazon Product',
		description: 'Track price drops, stock changes, and deals on Amazon products',
		longDescription: `Monitor any Amazon product for price changes, back-in-stock alerts, and deal notifications.
		Works with all Amazon regions including US, UK, Germany, France, and more.`,
		icon: 'https://www.amazon.com/favicon.ico',
		category: 'ecommerce',
		tags: ['shopping', 'price-tracking', 'deals', 'retail'],
		maintainers: ['alertnew'],
		richExamples: [
			{
				url: 'https://www.amazon.com/dp/B0D1XD1ZV3',
				title: 'Apple AirPods Pro (2nd Gen)',
			},
			{
				url: 'https://www.amazon.com/dp/B09XS7JWHH',
				title: 'Sony WH-1000XM5 Headphones',
			},
			{
				url: 'https://www.amazon.com/dp/B0CL61F39H',
				title: 'PlayStation 5 Console (slim)',
			},
		],
	},

	match: /amazon\.(com|co\.uk|de|fr|es|it|ca|com\.au|co\.jp|in|com\.mx|com\.br|nl|se|pl|be|sg|ae|sa|eg|com\.tr)/i,

	fields: {
		title: {
			type: 'string',
			label: 'Product Title',
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
			description: 'List price before discount',
		},
		discount: {
			type: 'string',
			label: 'Discount',
			description: 'Discount percentage',
		},
		inStock: {
			type: 'boolean',
			label: 'In Stock',
			primary: true,
		},
		rating: {
			type: 'number',
			label: 'Rating',
			description: 'Customer rating out of 5',
		},
		reviewCount: {
			type: 'number',
			label: 'Review Count',
			noise: true,
		},
		seller: {
			type: 'string',
			label: 'Sold By',
		},
		asin: {
			type: 'string',
			label: 'ASIN',
			description: 'Amazon Standard Identification Number',
		},
		brand: {
			type: 'string',
			label: 'Brand',
		},
		category: {
			type: 'string',
			label: 'Category',
		},
		bestSellerRank: {
			type: 'number',
			label: 'Best Seller Rank',
		},
		isPrime: {
			type: 'boolean',
			label: 'Prime Eligible',
		},
		isDeal: {
			type: 'boolean',
			label: 'Deal Active',
		},
		coupon: {
			type: 'string',
			label: 'Coupon',
			description: 'Available coupon discount',
		},
		deliveryDate: {
			type: 'string',
			label: 'Delivery Date',
		},
		imageUrl: {
			type: 'url',
			label: 'Product Image',
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
			id: 'back-in-stock',
			label: 'Back in Stock',
			description: 'Get notified when the item is back in stock',
			when: 'inStock == true && previous.inStock == false',
			icon: '📦',
		},
		{
			id: 'price-threshold',
			label: 'Price Under Target',
			description: 'Get notified when price drops below your target',
			when: 'price < $threshold',
			icon: '🎯',
		},
		{
			id: 'deal-started',
			label: 'Deal Started',
			description: 'Get notified when a deal becomes available',
			when: 'isDeal == true && previous.isDeal == false',
			icon: '🔥',
		},
		{
			id: 'coupon-available',
			label: 'Coupon Available',
			description: 'Get notified when a coupon is available',
			when: 'coupon != previous.coupon && coupon != null',
			icon: '🎟️',
		},
		{
			id: 'significant-drop',
			label: 'Significant Price Drop (10%+)',
			description: 'Get notified when price drops by 10% or more',
			when: 'price < previous.price * 0.9',
			icon: '📉',
		},
	],

	async extract(html: string, url: string): Promise<ExtractedData> {
		const data: ExtractedData = {}

		// Extract ASIN from URL
		const asinMatch = url.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i)
		if (asinMatch) {
			data.asin = asinMatch[1]
		}

		// Try JSON-LD first (most reliable)
		const jsonLd = extractJsonLd(html)
		for (const ld of jsonLd) {
			if (ld['@type'] === 'Product') {
				data.title = data.title || ld.name
				data.description = data.description || ld.description
				data.brand = ld.brand?.name || ld.brand
				data.imageUrl = ld.image?.[0] || ld.image

				if (ld.offers) {
					const offer = Array.isArray(ld.offers) ? ld.offers[0] : ld.offers
					if (offer.price) {
						data.price = parseFloat(offer.price)
					}
					if (offer.availability) {
						data.inStock = offer.availability.includes('InStock')
					}
				}

				if (ld.aggregateRating) {
					data.rating = parseFloat(ld.aggregateRating.ratingValue)
					data.reviewCount = parseInt(ld.aggregateRating.reviewCount, 10)
				}
			}
		}

		// Product title
		if (!data.title) {
			const title = extractFirst(html, /<span[^>]*id="productTitle"[^>]*>([^<]+)<\/span>/i)
			if (title) {
				data.title = decodeHtmlEntities(title.trim())
			}
		}

		// Meta tags fallback
		if (!data.title) {
			const meta = extractMetaTags(html)
			data.title = meta['og:title'] || meta['twitter:title']
		}

		// Structured price (whole + fraction) - try this first as it's most reliable
		if (!data.price) {
			const wholePriceMatch = html.match(/<span[^>]*class="[^"]*a-price-whole[^"]*"[^>]*>([0-9,]+)<\/span>/)
			const fractionMatch = html.match(/<span[^>]*class="[^"]*a-price-fraction[^"]*"[^>]*>([0-9]+)<\/span>/)
			if (wholePriceMatch) {
				const whole = wholePriceMatch[1].replace(/,/g, '')
				const fraction = fractionMatch ? fractionMatch[1] : '00'
				data.price = parseFloat(`${whole}.${fraction}`)
			}
		}

		// Price extraction with multiple patterns (fallback)
		const pricePatterns = [
			/<span[^>]*class="[^"]*a-offscreen[^"]*"[^>]*>\s*\$?([0-9,.]+)\s*<\/span>/i,
			/<span[^>]*id="priceblock_ourprice"[^>]*>([^<]+)<\/span>/i,
			/<span[^>]*id="priceblock_dealprice"[^>]*>([^<]+)<\/span>/i,
			/<span[^>]*id="priceblock_saleprice"[^>]*>([^<]+)<\/span>/i,
			/class="a-price"[^>]*>.*?<span[^>]*>([^<]+)<\/span>/is,
		]

		if (!data.price) {
			for (const pattern of pricePatterns) {
				const priceStr = extractFirst(html, pattern)
				if (priceStr) {
					const price = parsePrice(priceStr)
					if (price !== undefined && price > 0) {
						data.price = price
						break
					}
				}
			}
		}

		// Original/list price
		const originalPriceMatch = html.match(/<span[^>]*class="[^"]*a-text-price[^"]*"[^>]*data-a-strike="true"[^>]*>.*?\$?([0-9,.]+)/is)
		if (originalPriceMatch) {
			data.originalPrice = parsePrice(originalPriceMatch[1])
		}

		// Discount percentage
		const discountMatch = html.match(/<span[^>]*class="[^"]*savingsPercentage[^"]*"[^>]*>-?(\d+%)<\/span>/i)
		if (discountMatch) {
			data.discount = discountMatch[1]
		}

		// Stock status
		const stockPatterns = [
			/<span[^>]*class="[^"]*a-color-success[^"]*"[^>]*>([^<]*(?:in stock|available)[^<]*)<\/span>/i,
			/id="availability"[^>]*>.*?<span[^>]*>([^<]+)</is,
			/<span[^>]*class="[^"]*availabilityMessage[^"]*"[^>]*>([^<]+)<\/span>/i,
		]

		if (data.inStock === undefined) {
			for (const pattern of stockPatterns) {
				const stock = extractFirst(html, pattern)
				if (stock) {
					const stockLower = stock.toLowerCase()
					data.inStock = stockLower.includes('in stock') ||
						stockLower.includes('available') ||
						stockLower.includes('only') ||
						stockLower.includes('left in stock')
					break
				}
			}
		}

		// Out of stock indicators
		if (data.inStock === undefined) {
			const outOfStockPatterns = [
				/currently unavailable/i,
				/out of stock/i,
				/not available/i,
				/we don't know when or if this item will be back/i,
			]
			for (const pattern of outOfStockPatterns) {
				if (pattern.test(html)) {
					data.inStock = false
					break
				}
			}
		}

		// Default to in stock if we found a price
		if (data.inStock === undefined && data.price !== undefined) {
			data.inStock = true
		}

		// Rating
		if (!data.rating) {
			const ratingMatch = html.match(/<span[^>]*class="[^"]*a-icon-alt[^"]*"[^>]*>([0-9.]+)\s*out\s*of\s*5/i)
			if (ratingMatch) {
				data.rating = parseFloat(ratingMatch[1])
			}
		}

		// Review count
		if (!data.reviewCount) {
			const reviewPatterns = [
				/<span[^>]*id="acrCustomerReviewText"[^>]*>([0-9,]+)\s*(?:global\s*)?ratings?/i,
				/(\d[\d,]*)\s*(?:global\s*)?(?:ratings?|reviews?)/i,
			]
			for (const pattern of reviewPatterns) {
				const reviewMatch = html.match(pattern)
				if (reviewMatch) {
					data.reviewCount = parseInt(reviewMatch[1].replace(/,/g, ''), 10)
					break
				}
			}
		}

		// Brand
		if (!data.brand) {
			const brandPatterns = [
				/<a[^>]*id="bylineInfo"[^>]*>(?:Visit the |Brand: )?([^<]+)<\/a>/i,
				/id="bylineInfo"[^>]*>([^<]+)</i,
				/<tr[^>]*class="[^"]*po-brand[^"]*"[^>]*>.*?<span[^>]*class="[^"]*po-break-word[^"]*"[^>]*>([^<]+)<\/span>/is,
			]
			for (const pattern of brandPatterns) {
				const brand = extractFirst(html, pattern)
				if (brand) {
					data.brand = decodeHtmlEntities(brand.trim().replace(/^(Visit the |Brand: )/i, '').replace(/ Store$/, ''))
					break
				}
			}
		}

		// Seller
		const sellerMatch = html.match(/<a[^>]*id="sellerProfileTriggerId"[^>]*>([^<]+)<\/a>/i)
		if (sellerMatch) {
			data.seller = decodeHtmlEntities(sellerMatch[1].trim())
		} else {
			const soldByMatch = html.match(/Ships from and sold by\s*<[^>]*>([^<]+)</i)
			if (soldByMatch) {
				data.seller = decodeHtmlEntities(soldByMatch[1].trim())
			}
		}

		// Prime eligibility
		data.isPrime = /id="[^"]*prime[^"]*"|class="[^"]*prime[^"]*"|a]data-a-badge-type="prime"/i.test(html)

		// Deal badge
		data.isDeal = /id="[^"]*deal[^"]*badge|class="[^"]*dealBadge|Lightning Deal|Deal of the Day/i.test(html)

		// Coupon
		const couponMatch = html.match(/Save\s*(?:an\s*extra\s*)?\$?(\d+(?:\.\d+)?%?)\s*(?:with\s*coupon|coupon)/i)
		if (couponMatch) {
			data.coupon = couponMatch[1].includes('%') ? couponMatch[1] : `$${couponMatch[1]}`
		}

		// Best Seller Rank
		const bsrMatch = html.match(/#([\d,]+)\s*in\s*([^<(]+)/i)
		if (bsrMatch) {
			data.bestSellerRank = parseInt(bsrMatch[1].replace(/,/g, ''), 10)
			data.category = bsrMatch[2].trim()
		}

		// Delivery date
		const deliveryMatch = html.match(/delivery[^<]*<[^>]*>([^<]*(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)[^<]*)</i)
		if (deliveryMatch) {
			data.deliveryDate = decodeHtmlEntities(deliveryMatch[1].trim())
		}

		// Product image
		if (!data.imageUrl) {
			const imagePatterns = [
				/<img[^>]*id="landingImage"[^>]*src="([^"]+)"/i,
				/<img[^>]*id="imgBlkFront"[^>]*src="([^"]+)"/i,
				/<img[^>]*class="[^"]*a-dynamic-image[^"]*"[^>]*src="([^"]+)"/i,
			]
			for (const pattern of imagePatterns) {
				const imageMatch = html.match(pattern)
				if (imageMatch) {
					data.imageUrl = imageMatch[1]
					break
				}
			}
		}

		return data
	},
})
