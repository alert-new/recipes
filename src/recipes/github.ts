import { defineRecipe, type ExtractedData } from '../types'
import { extractFirst, decodeHtmlEntities, parseAbbreviatedNumber } from '../helpers'

export const githubRecipe = defineRecipe({
	meta: {
		slug: 'github',
		name: 'GitHub Repository',
		description: 'Track releases, stars, forks, and activity on GitHub repositories',
		longDescription: `Monitor any GitHub repository for new releases, star milestones,
		and activity changes. Perfect for tracking dependencies, open source projects,
		and keeping up with development progress.`,
		icon: 'https://github.githubassets.com/favicons/favicon.svg',
		category: 'developer',
		tags: ['code', 'open-source', 'releases', 'git'],
		maintainers: ['alertnew'],
		richExamples: [
			{
				url: 'https://github.com/facebook/react',
				title: 'facebook/react',
			},
			{
				url: 'https://github.com/vercel/next.js',
				title: 'vercel/next.js',
			},
			{
				url: 'https://github.com/tailwindlabs/tailwindcss',
				title: 'tailwindlabs/tailwindcss',
			},
		],
	},

	match: /^https?:\/\/(www\.)?github\.com\/[^/]+\/[^/]+\/?$/i,

	// GitHub blocks simple fetches, use browser rendering
	requiresJs: true,

	fields: {
		title: {
			type: 'string',
			label: 'Repository',
			primary: true,
		},
		description: {
			type: 'string',
			label: 'Description',
		},
		stars: {
			type: 'number',
			label: 'Stars',
			primary: true,
		},
		forks: {
			type: 'number',
			label: 'Forks',
		},
		watchers: {
			type: 'number',
			label: 'Watchers',
		},
		openIssues: {
			type: 'number',
			label: 'Open Issues',
		},
		latestRelease: {
			type: 'string',
			label: 'Latest Release',
			primary: true,
		},
		releaseDate: {
			type: 'date',
			label: 'Release Date',
		},
		primaryLanguage: {
			type: 'string',
			label: 'Primary Language',
		},
		license: {
			type: 'string',
			label: 'License',
		},
		topics: {
			type: 'string',
			label: 'Topics',
		},
		defaultBranch: {
			type: 'string',
			label: 'Default Branch',
		},
		createdAt: {
			type: 'date',
			label: 'Created',
		},
		updatedAt: {
			type: 'date',
			label: 'Last Updated',
			noise: true,
		},
		pushedAt: {
			type: 'date',
			label: 'Last Push',
		},
		size: {
			type: 'number',
			label: 'Size (KB)',
			noise: true,
		},
		isArchived: {
			type: 'boolean',
			label: 'Archived',
		},
		isFork: {
			type: 'boolean',
			label: 'Is Fork',
		},
		hasWiki: {
			type: 'boolean',
			label: 'Has Wiki',
		},
		hasPages: {
			type: 'boolean',
			label: 'Has Pages',
		},
		homepage: {
			type: 'url',
			label: 'Homepage',
		},
	},

	defaultAlerts: [
		{
			id: 'new-release',
			label: 'New Release',
			description: 'Get notified when a new version is released',
			when: 'latestRelease != previous.latestRelease',
			icon: '🚀',
		},
		{
			id: 'star-milestone',
			label: 'Star Milestone',
			description: 'Get notified when stars reach a milestone (1k, 10k, etc)',
			when: 'floor(stars / 1000) > floor(previous.stars / 1000)',
			icon: '⭐',
		},
		{
			id: 'trending',
			label: 'Trending Activity',
			description: 'Get notified when stars increase significantly',
			when: 'stars - previous.stars > 100',
			icon: '📈',
		},
		{
			id: 'archived',
			label: 'Repository Archived',
			description: 'Get notified if the repository is archived',
			when: 'isArchived == true && previous.isArchived == false',
			icon: '📦',
		},
		{
			id: 'new-push',
			label: 'New Code Push',
			description: 'Get notified when new code is pushed',
			when: 'pushedAt != previous.pushedAt',
			icon: '💻',
		},
	],

	async extract(html: string, url: string): Promise<ExtractedData> {
		const data: ExtractedData = {}

		// Try to parse as JSON (API response)
		try {
			const repo = JSON.parse(html)

			if (repo.full_name) {
				// This is a GitHub API response
				data.owner = repo.owner?.login
				data.repo = repo.name
				data.title = repo.full_name
				data.description = repo.description
				data.stars = repo.stargazers_count
				data.forks = repo.forks_count
				data.watchers = repo.subscribers_count // API uses subscribers for watchers
				data.openIssues = repo.open_issues_count
				data.primaryLanguage = repo.language
				data.license = repo.license?.spdx_id || repo.license?.name
				data.topics = repo.topics?.join(', ')
				data.defaultBranch = repo.default_branch
				data.createdAt = repo.created_at
				data.updatedAt = repo.updated_at
				data.pushedAt = repo.pushed_at
				data.size = repo.size
				data.isArchived = repo.archived
				data.isFork = repo.fork
				data.hasWiki = repo.has_wiki
				data.hasPages = repo.has_pages
				data.homepage = repo.homepage || undefined

				// Note: Latest release requires a separate API call
				// We'll try to fetch it if needed
				return data
			}
		} catch {
			// Not JSON, fall back to HTML parsing
		}

		// HTML fallback (if API fails or returns HTML)
		const urlParts = new URL(url).pathname.split('/').filter(Boolean)
		if (urlParts.length >= 2) {
			data.owner = urlParts[0]
			data.repo = urlParts[1]
			data.title = `${urlParts[0]}/${urlParts[1]}`
		}

		// Repository description
		const descPatterns = [
			/<p[^>]*class="[^"]*f4[^"]*my-3[^"]*"[^>]*>([^<]+)<\/p>/i,
			/<meta[^>]*name="description"[^>]*content="([^"]+)"/i,
			/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i,
		]

		for (const pattern of descPatterns) {
			const desc = extractFirst(html, pattern)
			if (desc && desc.length > 10) {
				data.description = decodeHtmlEntities(desc.trim())
				break
			}
		}

		// Stars
		const starsPatterns = [
			/<a[^>]*href="[^"]*\/stargazers"[^>]*>.*?<span[^>]*>([0-9,.kKmM]+)<\/span>/is,
			/<strong[^>]*>([0-9,.kKmM]+)<\/strong>\s*stars/i,
			/id="repo-stars-counter-star"[^>]*>([0-9,.kKmM]+)</i,
			/<span[^>]*class="[^"]*Counter[^"]*"[^>]*>([0-9,.kKmM]+)<\/span>\s*<span[^>]*>Star/i,
		]

		for (const pattern of starsPatterns) {
			const starsStr = extractFirst(html, pattern)
			if (starsStr) {
				data.stars = parseAbbreviatedNumber(starsStr)
				break
			}
		}

		// Forks
		const forksPatterns = [
			/<a[^>]*href="[^"]*\/forks"[^>]*>.*?<span[^>]*>([0-9,.kKmM]+)<\/span>/is,
			/<strong[^>]*>([0-9,.kKmM]+)<\/strong>\s*forks/i,
			/id="repo-network-counter"[^>]*>([0-9,.kKmM]+)</i,
		]

		for (const pattern of forksPatterns) {
			const forksStr = extractFirst(html, pattern)
			if (forksStr) {
				data.forks = parseAbbreviatedNumber(forksStr)
				break
			}
		}

		// Watchers
		const watchersPatterns = [
			/<a[^>]*href="[^"]*\/watchers"[^>]*>.*?<span[^>]*>([0-9,.kKmM]+)<\/span>/is,
			/<strong[^>]*>([0-9,.kKmM]+)<\/strong>\s*watching/i,
		]

		for (const pattern of watchersPatterns) {
			const watchersStr = extractFirst(html, pattern)
			if (watchersStr) {
				data.watchers = parseAbbreviatedNumber(watchersStr)
				break
			}
		}

		// Open issues
		const issuesPatterns = [
			/<span[^>]*class="[^"]*Counter[^"]*"[^>]*>([0-9,.kKmM]+)<\/span>\s*<span[^>]*>Issues/i,
			/Issues.*?<span[^>]*class="[^"]*Counter[^"]*"[^>]*>([0-9,.kKmM]+)<\/span>/is,
		]

		for (const pattern of issuesPatterns) {
			const issuesStr = extractFirst(html, pattern)
			if (issuesStr) {
				data.openIssues = parseAbbreviatedNumber(issuesStr)
				break
			}
		}

		// Latest release version
		const releasePatterns = [
			/<a[^>]*href="[^"]*\/releases\/tag\/([^"]+)"/i,
			/<span[^>]*class="[^"]*css-truncate-target[^"]*"[^>]*>([^<]+)<\/span>\s*Latest/i,
		]

		for (const pattern of releasePatterns) {
			const release = extractFirst(html, pattern)
			if (release) {
				try {
					data.latestRelease = decodeURIComponent(release)
				} catch {
					data.latestRelease = release
				}
				break
			}
		}

		// Primary language
		const langMatch = html.match(
			/<span[^>]*class="[^"]*color-fg-default[^"]*text-bold[^"]*mr-1[^"]*"[^>]*>([^<]+)<\/span>\s*<span[^>]*>([0-9.]+)%/i
		)
		if (langMatch) {
			data.primaryLanguage = langMatch[1]
		}

		// License
		const licenseMatch = html.match(
			/<a[^>]*href="[^"]*\/blob\/[^"]*LICENSE[^"]*"[^>]*>([^<]+)<\/a>/i
		)
		if (licenseMatch) {
			data.license = licenseMatch[1].trim()
		}

		return data
	},
})
