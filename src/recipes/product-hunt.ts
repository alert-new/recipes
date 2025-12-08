import { defineRecipe, type ExtractedData } from '../types'
import { extractFirst, extractMetaTags } from '../helpers'

export const productHuntRecipe = defineRecipe({
	meta: {
		slug: 'producthunt',
		name: 'Product Hunt',
		description: 'Track upvotes, comments, and ranking on Product Hunt',
		longDescription: `Monitor Product Hunt launches for upvotes, comments, and daily
			ranking. Perfect for tracking your own launches, competitor products, or
			discovering trending products before they go viral.`,
		icon: 'https://ph-static.imgix.net/ph-favicon.ico',
		category: 'developer',
		tags: ['startups', 'launches', 'products', 'tech'],
		maintainers: ['alertnew'],
		richExamples: [
			{
				url: 'https://www.producthunt.com/posts/drlambda',
				title: 'DrLambda',
			},
			{
				url: 'https://www.producthunt.com/posts/campsite-4',
				title: 'Campsite',
			},
		],
	},

	match: /^https?:\/\/(www\.)?producthunt\.com\/posts\//i,

	// Product Hunt blocks non-browser requests, requires JS rendering
	requiresJs: true,

	fields: {
		name: {
			type: 'string',
			label: 'Product Name',
			primary: true,
		},
		tagline: {
			type: 'string',
			label: 'Tagline',
		},
		upvotes: {
			type: 'number',
			label: 'Upvotes',
			primary: true,
		},
		comments: {
			type: 'number',
			label: 'Comments',
			primary: true,
		},
		rank: {
			type: 'number',
			label: 'Daily Rank',
			description: 'Position in daily top products',
		},
		makers: {
			type: 'string',
			label: 'Makers',
		},
		topics: {
			type: 'string',
			label: 'Topics',
		},
		launchDate: {
			type: 'date',
			label: 'Launch Date',
		},
		isFeatured: {
			type: 'boolean',
			label: 'Featured',
		},
		reviewScore: {
			type: 'number',
			label: 'Review Score',
			description: 'Average review rating (out of 5)',
		},
	},

	defaultAlerts: [
		{
			id: 'top-5',
			label: 'Top 5 Product',
			description: 'Get notified when reaching top 5 for the day',
			when: 'rank <= 5 && previous.rank > 5',
			icon: '🏆',
		},
		{
			id: 'upvote-milestone',
			label: 'Upvote Milestone',
			description: 'Get notified at upvote milestones (100, 500, 1000)',
			when: 'floor(upvotes / 100) > floor(previous.upvotes / 100)',
			icon: '⬆️',
		},
		{
			id: 'featured',
			label: 'Got Featured',
			description: 'Get notified when product gets featured',
			when: 'isFeatured == true && previous.isFeatured == false',
			icon: '⭐',
		},
		{
			id: 'rank-change',
			label: 'Ranking Changed',
			description: 'Get notified when daily rank changes significantly',
			when: 'abs(rank - previous.rank) >= 3',
			icon: '📊',
		},
		{
			id: 'new-comment',
			label: 'New Comments',
			description: 'Get notified when there are new comments',
			when: 'comments > previous.comments',
			icon: '💬',
		},
	],

	async extract(html: string, url: string): Promise<ExtractedData> {
		const data: ExtractedData = {}

		// Extract from meta tags
		const meta = extractMetaTags(html)

		// Name and tagline from og:title (usually "Name - Tagline")
		if (meta['og:title']) {
			const titleParts = meta['og:title'].split(' - ')
			data.name = titleParts[0]?.trim()
			if (titleParts[1]) {
				data.tagline = titleParts.slice(1).join(' - ').trim()
			}
		}

		// Description fallback for tagline
		if (!data.tagline && meta['og:description']) {
			data.tagline = meta['og:description']
		}

		// Try to find Apollo state (Product Hunt uses Apollo/GraphQL)
		const apolloMatch = html.match(/__APOLLO_STATE__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/i)
		if (apolloMatch) {
			try {
				const apolloState = JSON.parse(apolloMatch[1])

				// Find the post data in Apollo cache
				for (const [key, value] of Object.entries(apolloState)) {
					const item = value as any
					if (key.startsWith('Post:') && item.name) {
						data.name = data.name || item.name
						data.tagline = data.tagline || item.tagline
						data.upvotes = item.votesCount
						data.comments = item.commentsCount
						data.isFeatured = item.featuredAt !== null
						data.launchDate = item.createdAt

						// Topics
						if (item.topics?.length) {
							const topicRefs = item.topics
								.map((t: any) => {
									const topicData = apolloState[t.__ref] as any
									return topicData?.name
								})
								.filter(Boolean)
							data.topics = topicRefs.join(', ')
						}

						// Review score
						if (item.reviewsRating) {
							data.reviewScore = item.reviewsRating
						}

						break
					}
				}
			} catch {}
		}

		// Fallback: Extract from visible content
		if (!data.upvotes) {
			const upvoteMatch = extractFirst(html, /data-test="vote-button"[^>]*>(\d+)</)
			if (upvoteMatch) {
				data.upvotes = parseInt(upvoteMatch, 10)
			}
		}

		// Extract upvotes from various patterns
		const upvotePatterns = [
			/(\d+)\s*upvotes?/i,
			/"votesCount":\s*(\d+)/i,
			/data-vote-count="(\d+)"/i,
		]

		for (const pattern of upvotePatterns) {
			if (!data.upvotes) {
				const match = html.match(pattern)
				if (match) {
					data.upvotes = parseInt(match[1], 10)
				}
			}
		}

		// Comments count
		if (!data.comments) {
			const commentPatterns = [/"commentsCount":\s*(\d+)/i, /(\d+)\s*comments?/i]
			for (const pattern of commentPatterns) {
				const match = html.match(pattern)
				if (match) {
					data.comments = parseInt(match[1], 10)
					break
				}
			}
		}

		// Daily rank (if visible)
		const rankMatch = html.match(/#(\d+)\s*(?:Product of the Day|today)/i)
		if (rankMatch) {
			data.rank = parseInt(rankMatch[1], 10)
		}

		return data
	},
})
