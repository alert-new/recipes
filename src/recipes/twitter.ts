import { defineRecipe, type ExtractedData } from '../types'
import { extractMetaTags, parseAbbreviatedNumber, decodeHtmlEntities } from '../helpers'

export const twitterRecipe = defineRecipe({
	meta: {
		slug: 'twitter',
		name: 'X/Twitter Post',
		description: 'Track likes, retweets, and replies on X/Twitter',
		longDescription: `Monitor tweets and X posts for engagement metrics like likes,
			retweets, replies, and quote tweets. Works with both twitter.com and x.com
			URLs. Note: X has aggressive anti-scraping measures, so some data may
			require authentication or may be limited.`,
		icon: 'https://abs.twimg.com/favicons/twitter.3.ico',
		category: 'social',
		tags: ['social', 'microblogging', 'viral', 'news'],
		maintainers: ['alertnew'],
		richExamples: [
			{
				url: 'https://x.com/OpenAI/status/1869449598739587438',
				title: 'OpenAI announces o3',
			},
			{
				url: 'https://x.com/verabornnl/status/1866095904551768176',
				title: 'Vera Bonn on neural networks',
			},
		],
	},

	match: /^https?:\/\/(www\.)?(twitter\.com|x\.com)\/[^/]+\/status\/\d+/i,

	requiresJs: true,

	fields: {
		text: {
			type: 'string',
			label: 'Tweet Text',
			primary: true,
		},
		author: {
			type: 'string',
			label: 'Author',
		},
		authorHandle: {
			type: 'string',
			label: 'Handle',
		},
		likes: {
			type: 'number',
			label: 'Likes',
			primary: true,
		},
		retweets: {
			type: 'number',
			label: 'Retweets',
			primary: true,
		},
		replies: {
			type: 'number',
			label: 'Replies',
		},
		quotes: {
			type: 'number',
			label: 'Quote Tweets',
		},
		bookmarks: {
			type: 'number',
			label: 'Bookmarks',
		},
		views: {
			type: 'number',
			label: 'Views',
			noise: true,
		},
		isVerified: {
			type: 'boolean',
			label: 'Verified',
		},
		postedAt: {
			type: 'date',
			label: 'Posted',
		},
	},

	defaultAlerts: [
		{
			id: 'going-viral',
			label: 'Going Viral',
			description: 'Get notified when engagement spikes',
			when: 'likes + retweets > (previous.likes + previous.retweets) * 2',
			icon: '🚀',
		},
		{
			id: 'likes-milestone',
			label: 'Likes Milestone',
			description: 'Get notified at like milestones (100, 1K, 10K)',
			when: 'floor(log10(likes)) > floor(log10(previous.likes))',
			icon: '❤️',
		},
		{
			id: 'retweet-milestone',
			label: 'Retweet Milestone',
			description: 'Get notified at retweet milestones',
			when: 'floor(log10(retweets)) > floor(log10(previous.retweets))',
			icon: '🔁',
		},
		{
			id: 'ratio-alert',
			label: "Getting Ratio'd",
			description: 'Get notified when replies exceed likes (controversial)',
			when: 'replies > likes && previous.replies <= previous.likes',
			icon: '💀',
		},
	],

	async extract(html: string, url: string): Promise<ExtractedData> {
		const data: ExtractedData = {}

		// Extract from meta tags (most reliable for basic info)
		const meta = extractMetaTags(html)

		// Tweet text from og:description
		if (meta['og:description']) {
			data.text = decodeHtmlEntities(meta['og:description'])
		}

		// Author from og:title (usually "Author on X: tweet text")
		if (meta['og:title']) {
			const authorMatch = meta['og:title'].match(/^(.+?)\s+on\s+(?:X|Twitter):/i)
			if (authorMatch) {
				data.author = authorMatch[1]
			}
		}

		// Try to extract handle from URL
		const handleMatch = url.match(/(?:twitter\.com|x\.com)\/([^/]+)\/status/i)
		if (handleMatch) {
			data.authorHandle = `@${handleMatch[1]}`
		}

		// Try to find embedded JSON data (Twitter sometimes includes this)
		const jsonMatch = html.match(/"tweet_results":\s*(\{[\s\S]*?\})\s*,\s*"tweet/)
		if (jsonMatch) {
			try {
				const tweetData = JSON.parse(jsonMatch[1])
				const result = tweetData.result?.legacy || tweetData.result

				if (result) {
					data.text = data.text || result.full_text
					data.likes = result.favorite_count
					data.retweets = result.retweet_count
					data.replies = result.reply_count
					data.quotes = result.quote_count
					data.bookmarks = result.bookmark_count
					data.postedAt = result.created_at
				}
			} catch {}
		}

		// Fallback: Extract from aria-labels or visible text
		const likesMatch = html.match(/(\d+(?:\.\d+)?[KMB]?)\s*(?:likes?|Likes?)/i)
		if (likesMatch && !data.likes) {
			data.likes = parseAbbreviatedNumber(likesMatch[1])
		}

		const retweetsMatch = html.match(/(\d+(?:\.\d+)?[KMB]?)\s*(?:retweets?|Retweets?|reposts?)/i)
		if (retweetsMatch && !data.retweets) {
			data.retweets = parseAbbreviatedNumber(retweetsMatch[1])
		}

		const repliesMatch = html.match(/(\d+(?:\.\d+)?[KMB]?)\s*(?:replies?|Replies?)/i)
		if (repliesMatch && !data.replies) {
			data.replies = parseAbbreviatedNumber(repliesMatch[1])
		}

		const viewsMatch = html.match(/(\d+(?:\.\d+)?[KMB]?)\s*(?:views?|Views?)/i)
		if (viewsMatch) {
			data.views = parseAbbreviatedNumber(viewsMatch[1])
		}

		// Verified status
		data.isVerified =
			html.includes('aria-label="Verified account"') || html.includes('verified-badge')

		return data
	},
})
