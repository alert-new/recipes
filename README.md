# @alertnew/recipes

[![npm version](https://img.shields.io/npm/v/@alertnew/recipes.svg)](https://www.npmjs.com/package/@alertnew/recipes)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Open-source extraction recipes for [alert.new](https://alert.new)** - the easiest way to monitor any website for changes.

## What is alert.new?

[**alert.new**](https://alert.new) is a free website monitoring service that lets you:

- **Track price drops** on Amazon, eBay, and any e-commerce site
- **Get notified** when products come back in stock
- **Monitor GitHub repos** for new releases
- **Follow social media** metrics (YouTube views, Reddit upvotes, etc.)
- **Watch any webpage** for changes

**No coding required.** Just paste a URL and set your alert conditions.

**Try it free at [alert.new](https://alert.new)**

---

## What is a Recipe?

Recipes are the extraction logic that powers alert.new. They define:

- **URL matching** - Which websites this recipe handles
- **Fields** - What data to extract (price, stock, views, etc.)
- **Default alerts** - Pre-configured conditions users can enable
- **Extraction logic** - How to parse HTML/JSON into structured data

## Available Recipes

| Recipe | Website | Fields Extracted |
|--------|---------|-----------------|
| **amazon** | Amazon (all regions) | Price, stock, rating, reviews, deals, coupons, BSR |
| **ebay** | eBay | Price, bids, seller rating, shipping, time left |
| **github** | GitHub | Stars, forks, releases, issues, license, topics |
| **youtube** | YouTube | Views, likes, comments, subscribers, duration |
| **reddit** | Reddit | Score, comments, awards, upvote ratio |
| **hackernews** | Hacker News | Points, comments, author, rank |
| **npm** | npm Registry | Version, downloads, dependencies, license |
| **twitter** | X/Twitter | Author, verified status |
| **producthunt** | Product Hunt | Upvotes, comments, rank |
| **generic** | Any website | Title, description, meta tags, JSON-LD |

## Installation

```bash
npm install @alertnew/recipes
```

## Usage

```typescript
import { getRecipeForUrl, getRecipeBySlug } from '@alertnew/recipes'

// Get the right recipe for any URL
const recipe = getRecipeForUrl('https://www.amazon.com/dp/B0D1XD1ZV3')
console.log(recipe.meta.name) // "Amazon Product"

// Extract data from HTML
const html = await fetch(url).then(r => r.text())
const data = await recipe.extract(html, url)
console.log(data) // { title: "...", price: 29.99, inStock: true, ... }

// Or get a recipe by slug
const github = getRecipeBySlug('github')
```

## Contributing a Recipe

We welcome contributions! Help us support more websites.

### 1. Fork & Clone

```bash
git clone https://github.com/alert-new/recipes.git
cd recipes
npm install
```

### 2. Create Your Recipe

Create a new file in `src/recipes/`:

```typescript
import { defineRecipe } from '../types'

export const myRecipe = defineRecipe({
  meta: {
    slug: 'my-site',
    name: 'My Site',
    description: 'Track prices on My Site',
    icon: 'https://example.com/favicon.ico',
    category: 'ecommerce',
    tags: ['shopping', 'deals'],
    maintainers: ['your-github-username'],
    examples: ['https://example.com/product/123'],
  },

  match: /^https?:\/\/(www\.)?example\.com\/product\//i,

  fields: {
    title: { type: 'string', label: 'Title', primary: true },
    price: { type: 'currency', label: 'Price', primary: true },
    inStock: { type: 'boolean', label: 'In Stock' },
  },

  defaultAlerts: [
    {
      id: 'price-drop',
      label: 'Price Drop',
      description: 'Notify when price decreases',
      when: 'price < previous.price',
      icon: '💰',
    },
  ],

  async extract(html, url) {
    const data = {}
    // Your extraction logic here
    return data
  },
})
```

### 3. Test Your Recipe

```bash
npm test                    # Run unit tests
npm run validate            # Validate all recipes
npm run test:live           # Test against live URLs
```

### 4. Submit a PR

We'll review and merge quality contributions!

## Helper Functions

Import from `@alertnew/recipes`:

| Function | Description |
|----------|-------------|
| `extractFirst(html, regex)` | Extract first regex match |
| `extractAll(html, regex)` | Extract all matches |
| `extractMetaTags(html)` | Get all meta tags as object |
| `extractJsonLd(html)` | Parse JSON-LD structured data |
| `parsePrice(str)` | Parse "$1,234.56" to number |
| `parseAbbreviatedNumber(str)` | Parse "1.2K", "5M" to number |
| `decodeHtmlEntities(str)` | Decode &amp; etc. |

## Field Types

| Type | Description | Condition Support |
|------|-------------|-------------------|
| `string` | Text content | `=`, `!=`, `contains` |
| `number` | Numeric value | `<`, `>`, `<=`, `>=`, `=`, `!=` |
| `boolean` | True/false | `== true`, `== false` |
| `currency` | Money value | Same as number |
| `url` | URL string | `=`, `!=` |
| `date` | ISO date string | `=`, `!=` |

## Alert Conditions

The `when` expression supports:

```javascript
// Comparisons
price < 100
price < previous.price
inStock == true && previous.inStock == false

// Math
price < previous.price * 0.9     // 10% price drop

// Functions
floor(stars / 1000) > floor(previous.stars / 1000)  // Star milestone
```

## API Reference

```typescript
// Get all recipes
import { recipes, allRecipes } from '@alertnew/recipes'

// Find recipe for URL
import { getRecipeForUrl } from '@alertnew/recipes'
const recipe = getRecipeForUrl(url)

// Get recipe by slug
import { getRecipeBySlug } from '@alertnew/recipes'
const amazon = getRecipeBySlug('amazon')

// Types
import type { Recipe, RecipeField, ExtractedData } from '@alertnew/recipes'
```

## Fair Use & Legal

This repository is for **educational and personal use**. By using these recipes:

1. **Respect robots.txt** - Don't scrape disallowed pages
2. **Rate limit** - Don't overload target websites
3. **Public data only** - Only extract publicly available information
4. **Comply with ToS** - Follow each website's Terms of Service

[alert.new](https://alert.new) is designed for personal monitoring at reasonable intervals, not bulk data collection.

## Links

- **Website**: [alert.new](https://alert.new)
- **Documentation**: [alert.new/docs](https://alert.new/docs)
- **Issues**: [GitHub Issues](https://github.com/alert-new/recipes/issues)

## License

MIT - see [LICENSE](LICENSE)

---

**Start monitoring any website for free at [alert.new](https://alert.new)**
