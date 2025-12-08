import { defineRecipe, type ExtractedData } from '../types'
import { parseAbbreviatedNumber, decodeHtmlEntities, extractMetaTags } from '../helpers'

export const redditRecipe = defineRecipe({
	meta: {
		slug: 'reddit',
		name: 'Reddit Post',
		description: 'Track upvotes, comments, and awards on Reddit posts',
		longDescription: `Monitor Reddit posts for engagement metrics like upvotes, comments,
			and awards. Great for tracking your own posts or following discussions on
			topics you care about. Supports old.reddit.com and new Reddit.`,
		icon: 'https://www.reddit.com/favicon.ico',
		category: 'social',
		tags: ['social', 'discussions', 'community', 'viral'],
		maintainers: ['alertnew'],
		richExamples: [
			{
				url: 'https://www.reddit.com/r/programming/comments/1pe2quy/remember_xkcds_legendary_dependency_comic_i/',
				title: "Remember XKCD's legendary dependency comic? I finally built the thing",
			},
			{
				url: 'https://www.reddit.com/r/programming/comments/1pc4rim/the_death_of_software_engineering_as_a_profession/',
				title: 'The Death of Software Engineering as a Profession',
			},
		],
	},

	match: /^https?:\/\/(www\.|old\.|new\.)?reddit\.com\/r\/[^/]+\/comments\//i,

	// Use JSON API for cleaner extraction
	transformUrl: (url: string) => {
		const cleanUrl = url.replace(/\/$/, '').split('?')[0]
		return `${cleanUrl}.json`
	},

	headers: {
		Accept: 'application/json',
		'User-Agent': 'Mozilla/5.0 (compatible; AlertNewBot/1.0; +https://alert.new)',
	},

	fields: {
		title: {
			type: 'string',
			label: 'Post Title',
			primary: true,
		},
		score: {
			type: 'number',
			label: 'Score',
			description: 'Net upvotes (upvotes - downvotes)',
			primary: true,
		},
		upvoteRatio: {
			type: 'number',
			label: 'Upvote Ratio',
			description: 'Percentage of upvotes',
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
		authorKarma: {
			type: 'number',
			label: 'Author Karma',
		},
		subreddit: {
			type: 'string',
			label: 'Subreddit',
		},
		subredditSubscribers: {
			type: 'number',
			label: 'Subreddit Subscribers',
		},
		flair: {
			type: 'string',
			label: 'Post Flair',
		},
		authorFlair: {
			type: 'string',
			label: 'Author Flair',
		},
		isLocked: {
			type: 'boolean',
			label: 'Locked',
		},
		isPinned: {
			type: 'boolean',
			label: 'Pinned',
		},
		isArchived: {
			type: 'boolean',
			label: 'Archived',
		},
		awardCount: {
			type: 'number',
			label: 'Awards',
		},
		awards: {
			type: 'string',
			label: 'Award Types',
			description: 'List of award types received',
		},
		crosspostCount: {
			type: 'number',
			label: 'Crossposts',
			noise: true,
		},
		postType: {
			type: 'string',
			label: 'Post Type',
			description: 'text, link, image, video, poll, gallery',
		},
		domain: {
			type: 'string',
			label: 'Link Domain',
		},
		linkUrl: {
			type: 'url',
			label: 'Link URL',
		},
		thumbnailUrl: {
			type: 'url',
			label: 'Thumbnail',
			noise: true,
		},
		createdAt: {
			type: 'date',
			label: 'Created',
		},
		editedAt: {
			type: 'date',
			label: 'Edited',
		},
		isNsfw: {
			type: 'boolean',
			label: 'NSFW',
		},
		isSpoiler: {
			type: 'boolean',
			label: 'Spoiler',
		},
		isOc: {
			type: 'boolean',
			label: 'Original Content',
		},
		gilded: {
			type: 'number',
			label: 'Gold Awards',
		},
	},

	defaultAlerts: [
		{
			id: 'going-viral',
			label: 'Going Viral',
			description: 'Get notified when score increases rapidly',
			when: 'score - previous.score > 100',
			icon: '🚀',
		},
		{
			id: 'score-milestone',
			label: 'Score Milestone',
			description: 'Get notified at major milestones (100, 1k, 10k)',
			when: 'floor(log10(score)) > floor(log10(previous.score))',
			icon: '🎯',
		},
		{
			id: 'new-award',
			label: 'New Award',
			description: 'Get notified when post receives an award',
			when: 'awardCount > previous.awardCount',
			icon: '🏆',
		},
		{
			id: 'hot-discussion',
			label: 'Hot Discussion',
			description: 'Get notified when comments spike',
			when: 'comments - previous.comments > 50',
			icon: '💬',
		},
		{
			id: 'locked',
			label: 'Post Locked',
			description: 'Get notified when post is locked by moderators',
			when: 'isLocked == true && previous.isLocked == false',
			icon: '🔒',
		},
		{
			id: 'gilded',
			label: 'Post Gilded',
			description: 'Get notified when post receives gold',
			when: 'gilded > previous.gilded',
			icon: '🥇',
		},
		{
			id: 'edited',
			label: 'Post Edited',
			description: 'Get notified when post is edited',
			when: 'editedAt != previous.editedAt',
			icon: '✏️',
		},
	],

	async extract(html: string, url: string): Promise<ExtractedData> {
		const data: ExtractedData = {}

		try {
			// Parse JSON response (we transformed URL to .json)
			const json = JSON.parse(html)

			// Reddit returns an array: [post_data, comments_data]
			const postData = json[0]?.data?.children?.[0]?.data

			if (postData) {
				// Basic post info
				data.title = postData.title
				data.score = postData.score
				data.upvoteRatio = postData.upvote_ratio
				data.comments = postData.num_comments
				data.author = postData.author
				data.subreddit = postData.subreddit
				data.subredditSubscribers = postData.subreddit_subscribers

				// Flairs
				data.flair = postData.link_flair_text
				data.authorFlair = postData.author_flair_text

				// Post status
				data.isLocked = postData.locked
				data.isPinned = postData.stickied
				data.isArchived = postData.archived
				data.isNsfw = postData.over_18
				data.isSpoiler = postData.spoiler
				data.isOc = postData.is_original_content

				// Crossposts
				data.crosspostCount = postData.num_crossposts

				// Determine post type
				if (postData.is_self) {
					data.postType = 'text'
				} else if (postData.is_video) {
					data.postType = 'video'
				} else if (postData.is_gallery) {
					data.postType = 'gallery'
				} else if (postData.poll_data) {
					data.postType = 'poll'
				} else if (postData.post_hint === 'image') {
					data.postType = 'image'
				} else {
					data.postType = 'link'
				}

				// Link info (for non-self posts)
				if (!postData.is_self) {
					data.domain = postData.domain
					data.linkUrl = postData.url
				}

				// Thumbnail
				if (postData.thumbnail && postData.thumbnail !== 'self' && postData.thumbnail !== 'default') {
					data.thumbnailUrl = postData.thumbnail
				}

				// Awards
				if (postData.all_awardings && postData.all_awardings.length > 0) {
					data.awardCount = postData.all_awardings.reduce(
						(sum: number, award: { count: number }) => sum + award.count,
						0
					)

					// List unique award names
					const awardNames = postData.all_awardings
						.map((a: { name: string }) => a.name)
						.slice(0, 5)
					data.awards = awardNames.join(', ')
				}

				// Gilded (gold specifically)
				data.gilded = postData.gilded || 0

				// Timestamps
				if (postData.created_utc) {
					data.createdAt = new Date(postData.created_utc * 1000).toISOString()
				}
				if (postData.edited && postData.edited !== false) {
					data.editedAt = new Date(postData.edited * 1000).toISOString()
				}

				// Selftext (for text posts) - limited length
				if (postData.selftext && postData.selftext.length > 0) {
					data.selftext = postData.selftext.length > 500
						? postData.selftext.substring(0, 500) + '...'
						: postData.selftext
				}

				// Media info for video posts
				if (postData.media?.reddit_video) {
					data.videoDuration = postData.media.reddit_video.duration
					data.videoUrl = postData.media.reddit_video.fallback_url
				}

				// Gallery info
				if (postData.is_gallery && postData.gallery_data) {
					data.imageCount = postData.gallery_data.items?.length
				}

				// Poll info
				if (postData.poll_data) {
					data.pollTotalVotes = postData.poll_data.total_vote_count
					data.pollEndsAt = postData.poll_data.voting_end_timestamp
						? new Date(postData.poll_data.voting_end_timestamp).toISOString()
						: undefined
				}
			}
		} catch {
			// Fallback to HTML parsing if JSON fails
			const meta = extractMetaTags(html)
			data.title = meta['og:title'] || meta['twitter:title']
			data.description = meta['og:description']

			const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
			if (titleMatch && !data.title) {
				data.title = decodeHtmlEntities(titleMatch[1].trim())
			}

			// Score from HTML
			const scoreMatch = html.match(/(\d+(?:\.\d+)?[kKmM]?)\s*points?/i)
			if (scoreMatch) {
				data.score = parseAbbreviatedNumber(scoreMatch[1])
			}

			// Comments from HTML
			const commentsMatch = html.match(/(\d+(?:\.\d+)?[kKmM]?)\s*comments?/i)
			if (commentsMatch) {
				data.comments = parseAbbreviatedNumber(commentsMatch[1])
			}

			// Subreddit from URL
			const subredditMatch = url.match(/\/r\/([^/]+)/)
			if (subredditMatch) {
				data.subreddit = subredditMatch[1]
			}
		}

		return data
	},
})
