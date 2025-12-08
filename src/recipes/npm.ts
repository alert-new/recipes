import { defineRecipe, type ExtractedData } from '../types'

export const npmRecipe = defineRecipe({
	meta: {
		slug: 'npm',
		name: 'npm Package',
		description: 'Track downloads, versions, and dependencies on npm',
		longDescription: `Monitor npm packages for new releases, download trends, and
			dependency updates. Essential for staying on top of package updates,
			security patches, and library popularity.`,
		icon: 'https://static.npmjs.com/b0f1a8318363185cc2ea6a40ac23eeb2.png',
		category: 'developer',
		tags: ['javascript', 'nodejs', 'packages', 'libraries'],
		maintainers: ['alertnew'],
		richExamples: [
			{
				url: 'https://www.npmjs.com/package/react',
				title: 'react',
			},
			{
				url: 'https://www.npmjs.com/package/lodash',
				title: 'lodash',
			},
			{
				url: 'https://www.npmjs.com/package/express',
				title: 'express',
			},
		],
	},

	match: /^https?:\/\/(www\.)?npmjs\.com\/package\//i,

	// Use npm registry API for cleaner data
	transformUrl: (url: string) => {
		const packageName = url.match(/npmjs\.com\/package\/(.+?)(?:\/|$)/)?.[1]
		if (packageName) {
			return `https://registry.npmjs.org/${encodeURIComponent(packageName)}`
		}
		return url
	},

	headers: {
		Accept: 'application/json',
	},

	fields: {
		name: {
			type: 'string',
			label: 'Package Name',
			primary: true,
		},
		version: {
			type: 'string',
			label: 'Latest Version',
			primary: true,
		},
		description: {
			type: 'string',
			label: 'Description',
		},
		weeklyDownloads: {
			type: 'number',
			label: 'Weekly Downloads',
			noise: true,
		},
		license: {
			type: 'string',
			label: 'License',
		},
		dependencies: {
			type: 'number',
			label: 'Dependencies',
		},
		lastPublish: {
			type: 'date',
			label: 'Last Published',
		},
		deprecated: {
			type: 'boolean',
			label: 'Deprecated',
		},
		maintainerCount: {
			type: 'number',
			label: 'Maintainers',
		},
		typesIncluded: {
			type: 'boolean',
			label: 'TypeScript Types',
		},
	},

	defaultAlerts: [
		{
			id: 'new-version',
			label: 'New Version',
			description: 'Get notified when a new version is published',
			when: 'version != previous.version',
			icon: '📦',
		},
		{
			id: 'major-update',
			label: 'Major Update',
			description: 'Get notified on major version bumps',
			when: 'parseInt(version.split(".")[0]) > parseInt(previous.version.split(".")[0])',
			icon: '🚀',
		},
		{
			id: 'deprecated',
			label: 'Package Deprecated',
			description: 'Get notified if package is deprecated',
			when: 'deprecated == true && previous.deprecated == false',
			icon: '⚠️',
		},
		{
			id: 'popularity-spike',
			label: 'Popularity Spike',
			description: 'Get notified when downloads double',
			when: 'weeklyDownloads > previous.weeklyDownloads * 2',
			icon: '📈',
		},
	],

	async extract(html: string, url: string): Promise<ExtractedData> {
		const data: ExtractedData = {}

		try {
			// Parse JSON from registry API
			const pkg = JSON.parse(html)

			data.name = pkg.name
			data.description = pkg.description
			data.license = typeof pkg.license === 'string' ? pkg.license : pkg.license?.type

			// Get latest version info
			const latestVersion = pkg['dist-tags']?.latest
			if (latestVersion) {
				data.version = latestVersion

				const versionData = pkg.versions?.[latestVersion]
				if (versionData) {
					// Count dependencies
					const deps = versionData.dependencies || {}
					data.dependencies = Object.keys(deps).length

					// Check for TypeScript types
					data.typesIncluded =
						!!versionData.types || !!versionData.typings || pkg.name.startsWith('@types/')

					// Check for deprecation
					data.deprecated = !!versionData.deprecated
					if (versionData.deprecated && typeof versionData.deprecated === 'string') {
						data.deprecationMessage = versionData.deprecated
					}
				}
			}

			// Maintainers
			if (pkg.maintainers) {
				data.maintainerCount = pkg.maintainers.length
			}

			// Last publish time
			if (pkg.time?.[latestVersion]) {
				data.lastPublish = pkg.time[latestVersion]
			}

			// Repository info
			if (pkg.repository?.url) {
				data.repository = pkg.repository.url
					.replace(/^git\+/, '')
					.replace(/\.git$/, '')
					.replace('git://', 'https://')
			}

			// Homepage
			data.homepage = pkg.homepage

			// Keywords
			if (pkg.keywords?.length) {
				data.keywords = pkg.keywords.join(', ')
			}
		} catch {
			// Fallback: HTML parsing if API fails
			const versionMatch = html.match(/"version":\s*"([^"]+)"/i)
			if (versionMatch) {
				data.version = versionMatch[1]
			}

			const nameMatch = html.match(/"name":\s*"([^"]+)"/i)
			if (nameMatch) {
				data.name = nameMatch[1]
			}
		}

		return data
	},
})
