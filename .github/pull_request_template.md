## Recipe PR Checklist

### Type of Change
- [ ] New recipe
- [ ] Bug fix for existing recipe
- [ ] Improvement to existing recipe
- [ ] Documentation update

### For New Recipes

**Recipe slug:** `your-recipe-slug`
**Website:** https://example.com

#### Checklist
- [ ] Recipe file created in `src/recipes/`
- [ ] Recipe exported from `src/index.ts`
- [ ] All metadata fields completed (name, description, icon, category, tags, maintainers)
- [ ] At least one example URL that matches the pattern
- [ ] Extract function handles common page variations
- [ ] At least one default alert defined
- [ ] My GitHub username is in `maintainers` array
- [ ] `npm run typecheck` passes
- [ ] `npm run validate` passes
- [ ] `npm test` passes

### Testing
<!-- Describe how you tested this recipe -->

- [ ] Tested with example URLs locally
- [ ] Verified extraction returns expected data

### Screenshots (if applicable)
<!-- Add screenshots showing the extracted data -->

### Notes
<!-- Any additional context about this PR -->
