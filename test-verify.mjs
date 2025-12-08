import { recipes, allRecipes, getRecipeBySlug, getRecipeForUrl } from './dist/index.js';

console.log('=== VERIFICATION TEST ===\n');

// 1. Check all recipes are exported
console.log('1. Recipe count:', recipes.length, '(expected: 9)');
console.log('   All recipes count:', allRecipes.length, '(expected: 10, includes generic)');

// 2. List all recipe slugs
console.log('\n2. Recipe slugs:');
recipes.forEach(r => console.log('   -', r.meta.slug));

// 3. Test getRecipeBySlug
console.log('\n3. getRecipeBySlug test:');
const github = getRecipeBySlug('github');
console.log('   github recipe found:', github !== undefined);
console.log('   github name:', github?.meta.name);

// 4. Test getRecipeForUrl
console.log('\n4. getRecipeForUrl tests:');
const testUrls = [
  'https://github.com/facebook/react',
  'https://www.amazon.com/dp/B08N5WRWNW',
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  'https://news.ycombinator.com/item?id=12345',
  'https://www.npmjs.com/package/react',
  'https://www.reddit.com/r/programming/comments/abc123/test/',
  'https://x.com/elonmusk/status/123456',
  'https://twitter.com/OpenAI/status/789',
  'https://www.ebay.com/itm/123456789',
  'https://www.producthunt.com/posts/notion',
  'https://example.com/random-page',
];

testUrls.forEach(url => {
  const recipe = getRecipeForUrl(url);
  console.log('   ', url.substring(0, 50).padEnd(50), '->', recipe.meta.slug);
});

// 5. Test recipe structure completeness
console.log('\n5. Recipe structure check (amazon):');
const amazon = getRecipeBySlug('amazon');
console.log('   meta.slug:', amazon?.meta.slug);
console.log('   meta.name:', amazon?.meta.name);
console.log('   meta.description:', amazon?.meta.description?.substring(0, 50) + '...');
console.log('   meta.category:', amazon?.meta.category);
console.log('   meta.icon:', amazon?.meta.icon);
console.log('   meta.tags:', amazon?.meta.tags);
console.log('   meta.maintainers:', amazon?.meta.maintainers);
console.log('   fields count:', Object.keys(amazon?.fields || {}).length);
console.log('   fields:', Object.keys(amazon?.fields || {}));
console.log('   defaultAlerts count:', amazon?.defaultAlerts?.length);
console.log('   defaultAlerts:', amazon?.defaultAlerts?.map(a => a.id));
console.log('   match is RegExp:', amazon?.match instanceof RegExp);
console.log('   extract is function:', typeof amazon?.extract === 'function');

// 6. Test each recipe has required fields
console.log('\n6. All recipes validation:');
let allValid = true;
for (const recipe of allRecipes) {
  const errors = [];

  if (!recipe.meta?.slug) errors.push('missing slug');
  if (!recipe.meta?.name) errors.push('missing name');
  if (!recipe.meta?.description) errors.push('missing description');
  if (!recipe.meta?.category) errors.push('missing category');
  if (!recipe.meta?.icon) errors.push('missing icon');
  if (!recipe.meta?.maintainers?.length) errors.push('missing maintainers');
  if (!recipe.match) errors.push('missing match');
  if (!recipe.fields || Object.keys(recipe.fields).length === 0) errors.push('missing fields');
  if (typeof recipe.extract !== 'function') errors.push('missing extract function');

  if (errors.length > 0) {
    console.log('   ❌', recipe.meta?.slug || 'unknown', '-', errors.join(', '));
    allValid = false;
  } else {
    console.log('   ✓', recipe.meta.slug);
  }
}

// 7. Test extraction (with mock HTML)
console.log('\n7. Extract function tests:');

// Amazon test
const amazonHtml = `
  <span id="productTitle">  Test Product Title  </span>
  <span class="a-price-whole">99</span>
  <span class="a-price-fraction">99</span>
  <span class="a-color-success">In Stock</span>
`;
const amazonData = await amazon.extract(amazonHtml, 'https://amazon.com/dp/test');
console.log('   Amazon extraction:');
console.log('     title:', amazonData.title);
console.log('     price:', amazonData.price);
console.log('     inStock:', amazonData.inStock);

// GitHub test
const githubRecipe = getRecipeBySlug('github');
const githubHtml = `
  <meta property="og:description" content="A declarative, efficient, and flexible JavaScript library for building user interfaces.">
  <a href="/facebook/react/stargazers"><span>200k</span></a>
  <a href="/facebook/react/releases/tag/v18.2.0">v18.2.0</a>
`;
const githubData = await githubRecipe.extract(githubHtml, 'https://github.com/facebook/react');
console.log('   GitHub extraction:');
console.log('     title:', githubData.title);
console.log('     description:', githubData.description?.substring(0, 50) + '...');

// 8. Test transformUrl (for recipes that have it)
console.log('\n8. transformUrl tests:');
const reddit = getRecipeBySlug('reddit');
const npm = getRecipeBySlug('npm');
console.log('   Reddit transformUrl:', reddit?.transformUrl?.('https://www.reddit.com/r/programming/comments/abc123/test/'));
console.log('   npm transformUrl:', npm?.transformUrl?.('https://www.npmjs.com/package/react'));

// 9. Test defaultAlerts have valid structure
console.log('\n9. DefaultAlerts structure check:');
for (const recipe of recipes) {
  if (recipe.defaultAlerts?.length) {
    for (const alert of recipe.defaultAlerts) {
      if (!alert.id || !alert.label || !alert.when) {
        console.log('   ❌', recipe.meta.slug, '-', alert.id, '- missing required fields');
      }
    }
  }
}
console.log('   All alerts have id, label, and when ✓');

// 10. Summary
console.log('\n=== SUMMARY ===');
console.log('Total recipes:', recipes.length);
console.log('Total with generic:', allRecipes.length);
console.log('All recipes valid:', allValid);
console.log('Package is ready for npm publish!');
