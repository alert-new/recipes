import { defineRecipe, type ExtractedData } from '../types'
import { decodeHtmlEntities } from '../helpers'

export const hackernewsRecipe = defineRecipe({
	meta: {
		slug: 'hackernews',
		name: 'Hacker News',
		description: 'Track stories, comments, and points on Hacker News',
		longDescription: `Monitor Hacker News stories for point changes, new comments,
		and front page activity. Great for tracking your submissions or stories you're
		interested in.`,
		icon: 'https://news.ycombinator.com/favicon.ico',
		category: 'news',
		tags: ['tech', 'news', 'startup', 'programming'],
		maintainers: ['alertnew'],
		richExamples: [
			{
				url: 'https://news.ycombinator.com/item?id=46183294',
				title: 'I failed to recreate the 1996 Space Jam website with Claude',
			},
			{
				url: 'https://news.ycombinator.com/item?id=46147285',
				title: 'Uninitialized garbage on ia64 can be deadly (2004)',
			},
		],
	},

	match: /^https?:\/\/(www\.)?news\.ycombinator\.com\/(item|front|news|newest|best)/i,

	// Transform item URLs to use the official HN API
	transformUrl: (url: string) => {
		const itemMatch = url.match(/item\?id=(\d+)/)
		if (itemMatch) {
			return `https://hacker-news.firebaseio.com/v0/item/${itemMatch[1]}.json`
		}
		// For front page, get top stories IDs first
		if (url.includes('/front') || url.includes('/news') || url.endsWith('ycombinator.com') || url.endsWith('ycombinator.com/')) {
			return 'https://hacker-news.firebaseio.com/v0/topstories.json'
		}
		if (url.includes('/newest')) {
			return 'https://hacker-news.firebaseio.com/v0/newstories.json'
		}
		if (url.includes('/best')) {
			return 'https://hacker-news.firebaseio.com/v0/beststories.json'
		}
		return url
	},

	headers: {
		'Accept': 'application/json',
		'User-Agent': 'alert.new',
	},

	fields: {
		title: {
			type: 'string',
			label: 'Title',
			primary: true,
		},
		points: {
			type: 'number',
			label: 'Points',
			primary: true,
		},
		comments: {
			type: 'number',
			label: 'Comments',
			primary: true,
		},
		author: {
			type: 'string',
			label: 'Author',
		},
		rank: {
			type: 'number',
			label: 'Front Page Rank',
			description: 'Position on the front page (1-30)',
		},
		url: {
			type: 'url',
			label: 'Link URL',
		},
		domain: {
			type: 'string',
			label: 'Domain',
		},
		itemId: {
			type: 'number',
			label: 'Item ID',
		},
		createdAt: {
			type: 'date',
			label: 'Posted',
		},
		itemType: {
			type: 'string',
			label: 'Type',
			description: 'story, comment, job, poll, pollopt',
		},
		isDeleted: {
			type: 'boolean',
			label: 'Deleted',
		},
		isDead: {
			type: 'boolean',
			label: 'Dead',
		},
		// For front page listings
		topStoryCount: {
			type: 'number',
			label: 'Top Stories',
			description: 'Number of stories on the front page',
		},
	},

	defaultAlerts: [
		{
			id: 'front-page',
			label: 'Hit Front Page',
			description: 'Get notified when story reaches the front page',
			when: 'rank <= 30 && previous.rank > 30',
			icon: '🔥',
		},
		{
			id: 'points-milestone',
			label: 'Points Milestone',
			description: 'Get notified at point milestones (100, 500, 1000)',
			when: 'floor(points / 100) > floor(previous.points / 100)',
			icon: '⬆️',
		},
		{
			id: 'viral',
			label: 'Going Viral',
			description: 'Get notified when points increase rapidly',
			when: 'points - previous.points > 50',
			icon: '🚀',
		},
	],

	async extract(html: string, url: string): Promise<ExtractedData> {
		const data: ExtractedData = {}

		// Try to parse as JSON (API response)
		try {
			const json = JSON.parse(html)

			// If it's an array, it's a list of story IDs (topstories, newstories, etc.)
			if (Array.isArray(json)) {
				data.topStoryCount = json.length
				// The first ID is the current #1 story
				if (json.length > 0) {
					data.topStoryId = json[0]
				}
				return data
			}

			// Single item response
			if (json.id) {
				data.itemId = json.id
				data.title = json.title
				data.points = json.score
				data.author = json.by
				data.itemType = json.type
				data.isDeleted = json.deleted || false
				data.isDead = json.dead || false

				// Comments count (descendants = total comments in thread)
				if (json.descendants !== undefined) {
					data.comments = json.descendants
				} else if (json.kids) {
					data.comments = json.kids.length
				}

				// URL for link posts
				if (json.url) {
					data.url = json.url
					// Extract domain
					try {
						data.domain = new URL(json.url).hostname.replace(/^www\./, '')
					} catch {}
				}

				// Created timestamp
				if (json.time) {
					data.createdAt = new Date(json.time * 1000).toISOString()
				}

				// For text posts (Ask HN, Show HN, etc.)
				if (json.text) {
					data.text = json.text.length > 500 ? json.text.substring(0, 500) + '...' : json.text
				}

				return data
			}
		} catch {
			// Not JSON, fall back to HTML parsing
		}

		// HTML fallback (if API fails)
		const isItemPage = url.includes('item?id=')

		if (isItemPage) {
			// Single story/comment page
			const titleMatch = html.match(
				/<span[^>]*class="titleline"[^>]*>.*?<a[^>]*>([^<]+)<\/a>/is
			)
			if (titleMatch) {
				data.title = decodeHtmlEntities(titleMatch[1].trim())
			}

			// Points
			const pointsMatch = html.match(/<span[^>]*class="score"[^>]*>(\d+)\s*points?<\/span>/i)
			if (pointsMatch) {
				data.points = parseInt(pointsMatch[1], 10)
			}

			// Comments count
			const commentsMatch = html.match(/(\d+)\s*comments?/i)
			if (commentsMatch) {
				data.comments = parseInt(commentsMatch[1], 10)
			}

			// Author
			const authorMatch = html.match(/<a[^>]*class="hnuser"[^>]*>([^<]+)<\/a>/i)
			if (authorMatch) {
				data.author = authorMatch[1]
			}
		} else {
			// Front page or listing page
			const stories: Array<{ title: string; points: number; rank: number }> = []

			// Extract top stories
			const storyRegex =
				/<tr[^>]*class="athing"[^>]*>[\s\S]*?<span[^>]*class="titleline"[^>]*>.*?<a[^>]*>([^<]+)<\/a>/gi
			const pointsRegex = /<span[^>]*class="score"[^>]*>(\d+)\s*points?<\/span>/gi

			let storyMatch
			let rank = 0
			while ((storyMatch = storyRegex.exec(html)) !== null) {
				rank++
				stories.push({
					title: decodeHtmlEntities(storyMatch[1].trim()),
					points: 0,
					rank,
				})
			}

			// Match points to stories
			let pointsMatch
			let i = 0
			while ((pointsMatch = pointsRegex.exec(html)) !== null && i < stories.length) {
				stories[i].points = parseInt(pointsMatch[1], 10)
				i++
			}

			// Store top story info
			if (stories.length > 0) {
				data.topStoryTitle = stories[0].title
				data.topStoryPoints = stories[0].points
				data.storyCount = stories.length
			}

			// Calculate total points on front page
			data.totalFrontPagePoints = stories.reduce((sum, s) => sum + s.points, 0)
		}

		return data
	},
})
