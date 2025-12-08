# Contributing to @alertnew/recipes

Thank you for your interest in contributing! This guide will help you add new recipes or improve existing ones.

## Quick Start

1. Fork this repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/recipes.git`
3. Install dependencies: `npm install`
4. Create a new recipe in `src/recipes/`
5. Test your recipe: `npm test`
6. Submit a pull request

## Creating a New Recipe

### 1. Create the Recipe File

Create a new file in `src/recipes/` with your site name (e.g., `spotify.ts`):

```typescript
import { defineRecipe, type ExtractedData } from '../types'
import { extractFirst, extractMetaTags } from '../helpers'

export const spotifyRecipe = defineRecipe({
  meta: {
    slug: 'spotify',
    name: 'Spotify Album',
    description: 'Track new releases and album info on Spotify',
    icon: 'https://spotify.com/favicon.ico',
    category: 'entertainment',
    tags: ['music', 'streaming', 'albums'],
    maintainers: ['your-github-username'],
    examples: [
      'https://open.spotify.com/album/xyz',
    ],
  },

  match: /^https?:\/\/open\.spotify\.com\/album\//i,

  fields: {
    name: {
      type: 'string',
      label: 'Album Name',
      primary: true,
    },
    artist: {
      type: 'string',
      label: 'Artist',
    },
    trackCount: {
      type: 'number',
      label: 'Tracks',
    },
  },

  defaultAlerts: [
    {
      id: 'new-album',
      label: 'New Album',
      description: 'Get notified when artist releases new album',
      when: 'name != previous.name',
      icon: '🎵',
    },
  ],

  async extract(html: string, url: string): Promise<ExtractedData> {
    const data: ExtractedData = {}

    // Your extraction logic here

    return data
  },
})
```

### 2. Export from Index

Add your recipe to `src/index.ts`:

```typescript
export { spotifyRecipe } from './recipes/spotify'

// Add to recipes array
import { spotifyRecipe } from './recipes/spotify'
export const recipes: Recipe[] = [
  // ... existing recipes
  spotifyRecipe,
]
```

### 3. Test Your Recipe

Create a test file or manually test:

```bash
npm test
```

## Recipe Guidelines

### URL Matching

- Use specific regex patterns that won't match unrelated URLs
- Test your pattern against multiple URL formats (www, non-www, etc.)

### Fields

- Mark important fields as `primary: true` (shown by default)
- Use `noise: true` for fields that change frequently without significance
- Choose appropriate types: `string`, `number`, `boolean`, `currency`, `url`, `date`

### Extraction

1. **Prefer structured data**: JSON-LD, meta tags, embedded JSON
2. **Use fallbacks**: Not all pages have the same structure
3. **Handle errors gracefully**: Use try/catch and return partial data
4. **Don't over-extract**: Only extract what's useful for alerts

### Alert Conditions

- Keep conditions simple and focused
- Use `previous.fieldName` to compare with last check
- Available functions: `floor()`, `ceil()`, `abs()`, `log10()`
- Avoid conditions that would trigger too frequently

## Categories

Choose the most appropriate category:

- `ecommerce` - Shopping, price tracking
- `developer` - Code, packages, tools
- `social` - Social media, forums
- `news` - News sites, blogs
- `entertainment` - Video, music, games
- `finance` - Stocks, crypto
- `jobs` - Job postings
- `status` - Status pages
- `travel` - Flights, hotels
- `government` - Government sites
- `other` - Everything else

## Code Style

- Use TypeScript
- Follow existing patterns
- Use helper functions from `../helpers`
- Keep extraction logic focused and readable

## Pull Request Checklist

- [ ] Recipe has complete metadata (name, description, icon, examples)
- [ ] URL matching is specific and tested
- [ ] Fields have appropriate types and labels
- [ ] At least one default alert is defined
- [ ] Extraction handles common page variations
- [ ] Your GitHub username is in `maintainers`
- [ ] Recipe is exported from `src/index.ts`
- [ ] Tests pass: `npm test`
- [ ] Types check: `npm run typecheck`

## Questions?

Open an issue or reach out on [Twitter/X](https://x.com/alertdotnew).
