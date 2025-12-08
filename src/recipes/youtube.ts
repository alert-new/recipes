import { defineRecipe, type ExtractedData } from '../types'
import { extractFirst, parseAbbreviatedNumber, decodeHtmlEntities, extractJsonLd, extractMetaTags } from '../helpers'

export const youtubeRecipe = defineRecipe({
	meta: {
		slug: 'youtube',
		name: 'YouTube Video',
		description: 'Track views, likes, and comments on YouTube videos',
		longDescription: `Monitor YouTube videos for engagement metrics like views, likes,
			and comments. Perfect for tracking video performance, competitor analysis,
			or staying updated on your favorite creators. Also detects subscriber counts
			on channel pages.`,
		icon: 'https://www.youtube.com/favicon.ico',
		category: 'entertainment',
		tags: ['video', 'streaming', 'social', 'viral'],
		maintainers: ['alertnew'],
		richExamples: [
			{
				url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
				title: 'Rick Astley - Never Gonna Give You Up',
			},
			{
				url: 'https://www.youtube.com/@MrBeast',
				title: 'MrBeast',
			},
			{
				url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
				title: 'Me at the zoo',
			},
		],
	},

	match: /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i,

	fields: {
		title: {
			type: 'string',
			label: 'Video Title',
			primary: true,
		},
		channelName: {
			type: 'string',
			label: 'Channel',
		},
		channelId: {
			type: 'string',
			label: 'Channel ID',
		},
		videoId: {
			type: 'string',
			label: 'Video ID',
		},
		views: {
			type: 'number',
			label: 'Views',
			primary: true,
		},
		likes: {
			type: 'number',
			label: 'Likes',
			primary: true,
		},
		comments: {
			type: 'number',
			label: 'Comments',
		},
		subscribers: {
			type: 'number',
			label: 'Subscribers',
			description: 'Channel subscriber count',
		},
		duration: {
			type: 'string',
			label: 'Duration',
		},
		durationSeconds: {
			type: 'number',
			label: 'Duration (seconds)',
		},
		publishedAt: {
			type: 'date',
			label: 'Published',
		},
		description: {
			type: 'string',
			label: 'Description',
		},
		category: {
			type: 'string',
			label: 'Category',
		},
		tags: {
			type: 'string',
			label: 'Tags',
		},
		isLive: {
			type: 'boolean',
			label: 'Live Stream',
		},
		isShort: {
			type: 'boolean',
			label: 'YouTube Short',
		},
		isUnlisted: {
			type: 'boolean',
			label: 'Unlisted',
		},
		thumbnailUrl: {
			type: 'url',
			label: 'Thumbnail',
			noise: true,
		},
		isVerified: {
			type: 'boolean',
			label: 'Verified Channel',
		},
		totalVideos: {
			type: 'number',
			label: 'Total Videos',
			description: 'Channel total video count',
		},
	},

	defaultAlerts: [
		{
			id: 'new-video',
			label: 'New Video',
			description: 'Get notified when a new video is uploaded',
			when: 'title != previous.title',
			icon: '🎬',
		},
		{
			id: 'went-live',
			label: 'Went Live',
			description: 'Get notified when channel starts streaming',
			when: 'isLive == true && previous.isLive == false',
			icon: '🔴',
		},
		{
			id: 'views-milestone',
			label: 'Views Milestone',
			description: 'Get notified at view milestones (1K, 10K, 100K, 1M)',
			when: 'floor(log10(views)) > floor(log10(previous.views))',
			icon: '👀',
		},
		{
			id: 'subscriber-milestone',
			label: 'Subscriber Milestone',
			description: 'Get notified at subscriber milestones',
			when: 'floor(subscribers / 1000) > floor(previous.subscribers / 1000)',
			icon: '🔔',
		},
		{
			id: 'going-viral',
			label: 'Going Viral',
			description: 'Get notified when views increase rapidly',
			when: 'views - previous.views > 10000',
			icon: '🚀',
		},
		{
			id: 'likes-milestone',
			label: 'Likes Milestone',
			description: 'Get notified at like milestones',
			when: 'floor(log10(likes)) > floor(log10(previous.likes))',
			icon: '👍',
		},
	],

	async extract(html: string, url: string): Promise<ExtractedData> {
		const data: ExtractedData = {}

		// Extract video ID from URL
		const videoIdMatch = url.match(/(?:watch\?v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/)
		if (videoIdMatch) {
			data.videoId = videoIdMatch[1]
			data.thumbnailUrl = `https://i.ytimg.com/vi/${videoIdMatch[1]}/maxresdefault.jpg`
		}

		// Detect content type
		const isChannelPage = url.includes('/@') || url.includes('/channel/') || url.includes('/c/')
		const isShort = url.includes('/shorts/')
		if (isShort) {
			data.isShort = true
		}

		// Try JSON-LD first
		const jsonLd = extractJsonLd(html)
		for (const ld of jsonLd) {
			if (ld['@type'] === 'VideoObject') {
				data.title = ld.name
				data.description = ld.description
				data.duration = ld.duration
				data.publishedAt = ld.uploadDate
				data.thumbnailUrl = data.thumbnailUrl || ld.thumbnailUrl?.[0] || ld.thumbnailUrl

				if (ld.interactionStatistic) {
					const stats = Array.isArray(ld.interactionStatistic) ? ld.interactionStatistic : [ld.interactionStatistic]
					for (const stat of stats) {
						if (stat.interactionType?.includes('Watch')) {
							data.views = parseInt(stat.userInteractionCount, 10)
						}
						if (stat.interactionType?.includes('Like')) {
							data.likes = parseInt(stat.userInteractionCount, 10)
						}
					}
				}
			}
		}

		// Extract from ytInitialPlayerResponse (embedded JSON - most reliable)
		const playerMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{[\s\S]*?\});/)
		if (playerMatch) {
			try {
				const playerData = JSON.parse(playerMatch[1])
				const videoDetails = playerData.videoDetails
				if (videoDetails) {
					data.title = data.title || videoDetails.title
					data.channelName = videoDetails.author
					data.channelId = videoDetails.channelId
					data.videoId = data.videoId || videoDetails.videoId
					data.views = parseInt(videoDetails.viewCount, 10)
					data.description = data.description || videoDetails.shortDescription

					if (videoDetails.lengthSeconds) {
						const seconds = parseInt(videoDetails.lengthSeconds, 10)
						data.durationSeconds = seconds
						data.duration = formatDuration(seconds)
					}

					data.isLive = videoDetails.isLiveContent === true
					data.isUnlisted = videoDetails.isUnlisted === true

					if (videoDetails.keywords) {
						data.tags = Array.isArray(videoDetails.keywords)
							? videoDetails.keywords.slice(0, 10).join(', ')
							: videoDetails.keywords
					}
				}

				// Microformat has additional data
				const microformat = playerData.microformat?.playerMicroformatRenderer
				if (microformat) {
					data.category = microformat.category
					data.publishedAt = data.publishedAt || microformat.publishDate
					data.thumbnailUrl = data.thumbnailUrl || microformat.thumbnail?.thumbnails?.[0]?.url
				}
			} catch {}
		}

		// Extract from ytInitialData (more stats including likes, comments, subs)
		const dataMatch = html.match(/ytInitialData\s*=\s*(\{[\s\S]*?\});/)
		if (dataMatch) {
			try {
				const ytData = JSON.parse(dataMatch[1])

				// Video page data
				const primaryInfo =
					ytData.contents?.twoColumnWatchNextResults?.results?.results?.contents?.find(
						(c: any) => c.videoPrimaryInfoRenderer
					)?.videoPrimaryInfoRenderer

				if (primaryInfo) {
					data.title = data.title || primaryInfo.title?.runs?.[0]?.text

					// Views from primary info
					const viewText = primaryInfo.viewCount?.videoViewCountRenderer?.viewCount?.simpleText
					if (viewText) {
						data.views = data.views || parseAbbreviatedNumber(viewText.replace(/[^0-9.KMB]/gi, ''))
					}

					// Likes (from toggle button)
					const likeButton = primaryInfo.videoActions?.menuRenderer?.topLevelButtons?.find(
						(b: any) => b.segmentedLikeDislikeButtonRenderer || b.toggleButtonRenderer
					)
					if (likeButton) {
						const likeCount = likeButton.segmentedLikeDislikeButtonRenderer?.likeButton?.toggleButtonRenderer?.defaultText?.accessibility?.accessibilityData?.label ||
							likeButton.toggleButtonRenderer?.defaultText?.accessibility?.accessibilityData?.label
						if (likeCount) {
							const likesMatch = likeCount.match(/([\d,.]+[KMB]?)/i)
							if (likesMatch) {
								data.likes = parseAbbreviatedNumber(likesMatch[1].replace(/,/g, ''))
							}
						}
					}
				}

				// Secondary info (channel info)
				const secondaryInfo =
					ytData.contents?.twoColumnWatchNextResults?.results?.results?.contents?.find(
						(c: any) => c.videoSecondaryInfoRenderer
					)?.videoSecondaryInfoRenderer

				if (secondaryInfo) {
					const owner = secondaryInfo.owner?.videoOwnerRenderer
					if (owner) {
						data.channelName = data.channelName || owner.title?.runs?.[0]?.text

						const subText = owner.subscriberCountText?.simpleText
						if (subText) {
							data.subscribers = parseAbbreviatedNumber(subText.replace(/[^0-9.KMB]/gi, ''))
						}

						// Verified badge
						data.isVerified = owner.badges?.some((b: any) =>
							b.metadataBadgeRenderer?.style?.includes('VERIFIED')
						) || false
					}
				}

				// Comments section
				const commentsSection = ytData.contents?.twoColumnWatchNextResults?.results?.results?.contents?.find(
					(c: any) => c.itemSectionRenderer?.contents?.[0]?.commentsEntryPointHeaderRenderer
				)
				if (commentsSection) {
					const commentCount = commentsSection.itemSectionRenderer?.contents?.[0]?.commentsEntryPointHeaderRenderer?.commentCount?.simpleText
					if (commentCount) {
						data.comments = parseAbbreviatedNumber(commentCount.replace(/[^0-9.KMB]/gi, ''))
					}
				}

				// Channel page data
				const channelHeader = ytData.header?.c4TabbedHeaderRenderer || ytData.header?.pageHeaderRenderer
				if (channelHeader) {
					data.channelName = data.channelName || channelHeader.title

					const subText = channelHeader.subscriberCountText?.simpleText
					if (subText) {
						data.subscribers = parseAbbreviatedNumber(subText.replace(/[^0-9.KMB]/gi, ''))
					}

					// Video count for channels
					const videosTab = ytData.contents?.twoColumnBrowseResultsRenderer?.tabs?.find(
						(t: any) => t.tabRenderer?.title === 'Videos'
					)
					if (videosTab?.tabRenderer?.content?.richGridRenderer?.header?.feedFilterChipBarRenderer) {
						// This would need more parsing for total video count
					}
				}

				// Channel metadata
				const channelMetadata = ytData.metadata?.channelMetadataRenderer
				if (channelMetadata) {
					data.channelName = data.channelName || channelMetadata.title
					data.description = data.description || channelMetadata.description
					data.channelId = data.channelId || channelMetadata.externalId
				}

			} catch {}
		}

		// Fallback: Extract from meta tags
		const meta = extractMetaTags(html)
		if (!data.title) {
			data.title = meta['og:title'] || meta['twitter:title']
		}
		if (!data.description) {
			data.description = meta['og:description'] || meta['twitter:description']
		}
		if (!data.thumbnailUrl) {
			data.thumbnailUrl = meta['og:image'] || meta['twitter:image']
		}

		// Extract likes from engagement panel JSON (fallback)
		if (!data.likes) {
			const likesMatch = html.match(/"label":"([\d,.]+[KMB]?)\s*likes?"/i)
			if (likesMatch) {
				data.likes = parseAbbreviatedNumber(likesMatch[1].replace(/,/g, ''))
			}
		}

		// Comments count fallback
		if (!data.comments) {
			const commentsPatterns = [
				/"commentCount":\s*"([\d,]+)"/i,
				/"commentCount":\s*\{"simpleText":\s*"([\d,]+[KMB]?)"\}/i,
			]
			for (const pattern of commentsPatterns) {
				const match = html.match(pattern)
				if (match) {
					data.comments = parseAbbreviatedNumber(match[1].replace(/,/g, ''))
					break
				}
			}
		}

		// Clean up description (limit length)
		if (data.description && typeof data.description === 'string' && data.description.length > 500) {
			data.description = data.description.substring(0, 500) + '...'
		}

		return data
	},
})

function formatDuration(seconds: number): string {
	const hours = Math.floor(seconds / 3600)
	const minutes = Math.floor((seconds % 3600) / 60)
	const secs = seconds % 60

	if (hours > 0) {
		return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
	}
	return `${minutes}:${secs.toString().padStart(2, '0')}`
}
