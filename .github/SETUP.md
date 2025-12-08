# Repository Setup Guide

After creating this repository, configure these settings:

## Note on JS-Required Recipes

Two recipes require JavaScript rendering and are skipped in CI tests:
- `twitter` - X blocks non-browser requests
- `producthunt` - ProductHunt blocks non-browser requests (403)

These will work in production with a headless browser but can't be tested in CI.

## 1. Branch Protection Rules

Go to **Settings > Branches > Add rule** for `main`:

- [x] Require a pull request before merging
  - [x] Require approvals: 1
  - [x] Dismiss stale pull request approvals when new commits are pushed
- [x] Require status checks to pass before merging
  - [x] Require branches to be up to date before merging
  - Status checks required:
    - `lint-and-test`
- [x] Do not allow bypassing the above settings

## 2. GitHub Actions Secrets

Go to **Settings > Secrets and variables > Actions**:

### Required
- `NPM_TOKEN` - npm access token for publishing `@alertnew/recipes`
  - Create at https://www.npmjs.com/settings/YOUR_USERNAME/tokens
  - Type: Automation token

### Optional
- `DEPLOY_WEBHOOK_URL` - URL to trigger alert.new redeploy
- `DEPLOY_WEBHOOK_TOKEN` - Auth token for webhook

## 3. npm Package Setup

1. Create npm account or use existing one
2. Create organization `@alertnew` (or use user scope)
3. Generate automation token
4. Add as `NPM_TOKEN` secret

## 4. CODEOWNERS (Optional)

Create `.github/CODEOWNERS` to auto-assign reviewers:

```
# Default reviewers
* @your-username

# Recipe-specific reviewers (maintainers)
src/recipes/github.ts @alertdotnew
```

## 5. Issue Templates (Optional)

Consider adding:
- Bug report template
- Recipe request template
