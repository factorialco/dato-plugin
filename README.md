# DatoCMS Plugin

A custom DatoCMS plugin that provides form management and validation tools.

## How to run this repo locally

This project uses [pnpm](https://pnpm.io/), [Vite](https://vite.dev/) and [Vitest](https://vitest.dev/).

1 - Install dependencies

```
pnpm install
```

2 - Run the dev server (http://localhost:3000)

```
pnpm start
```

No `.env` file is needed: the plugin is configured from its settings screen inside DatoCMS (see [Configuration](#configuration)).

## Other commands

```
pnpm build         # typecheck + production build into build/
pnpm preview       # serve the production build locally
pnpm test          # run the Vitest suite once
pnpm test:watch    # run Vitest in watch mode
pnpm typecheck     # tsc --noEmit
pnpm lint          # oxlint
pnpm lint:fix      # oxlint --fix
pnpm format        # oxfmt
pnpm format:check  # oxfmt --check
```

Linting and formatting use [oxlint](https://oxc.rs/) and [oxfmt](https://oxc.rs/) with the [Ultracite](https://www.ultracite.ai/) presets, matching the Factorial webpage. `oxlint.config.mjs` extends `core` + `react` + `vitest`; the webpage's `next` preset does not apply here. All of the above run in CI on every pull request.

## Hosting

The plugin is a static bundle that DatoCMS loads in an iframe. It is published to **GitHub Pages** at:

```
https://factorialco.github.io/dato-plugin/
```

That URL is what the plugin's entry point should point at in DatoCMS. Deployment is automatic: [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds and publishes on every push to `main`, and can also be run manually from the Actions tab.

Vite is configured with `base: './'`, so the build works unchanged under the `/dato-plugin/` subpath a project Pages site is served from.

The deploy is gated: it reuses the same lint/format/typecheck/test/build checks a pull request gets (via `workflow_call`), so a broken `main` is never published to the plugin editors actually load.

### Vercel

The plugin used to be hosted on Vercel. `vercel.json` sets `git.deploymentEnabled: false`, which stops Vercel from creating deployments and posting checks on pull requests — this is the only lever that works from inside the repo.

To remove it for good, someone with org admin (or Vercel access) needs to disconnect the two Vercel projects still linked to this repo, or drop this repo from the Vercel GitHub App's repository access. Once that is done, `vercel.json` can be deleted.

### Keeping it out of search

The page carries `<meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />`. That meta tag is what actually does the work here: GitHub Pages cannot set an `X-Robots-Tag` header, and a *project* Pages site's `robots.txt` is ignored by crawlers, which only read the one at the domain root (`factorialco.github.io/robots.txt`, owned by a different repo). The `robots.txt` in `public/` is kept for the case where this later moves to a custom domain.

Note that a GitHub Pages site for a public repo is publicly reachable by anyone with the URL — `noindex` keeps it out of search results, it is not access control. Nothing sensitive is in the bundle: all configuration lives in DatoCMS plugin parameters, not in the build.

## Configuration

Settings live on the plugin's own details page in DatoCMS (Settings → Plugins → Factorial Dato Plugin), rendered by the `renderConfigScreen` hook. They are stored as [plugin parameters](https://www.datocms.com/docs/plugin-sdk/config-screen) and propagate to all users in real time, so changing one does not require a rebuild or redeploy.

| Setting | Purpose |
| --- | --- |
| Live preview base URL | Front-end that renders the "Live preview" sidebar. Empty (the default) hides the sidebar entirely. |
| Live preview models | Comma-separated model API keys to offer the preview on. Empty means every model. |
| Demo landing page model ID | Model whose published control/variant pages are checked against the limit. |
| Form template model ID | Model that gets the form fields validation addon. |
| Form fields field API key | Field on that model the addon attaches to. |
| Block publishing when the demo landing page limit is exceeded | Off (default): editors are only warned. On: publishing is refused. |

Every setting except the preview URL falls back to the value the plugin previously hardcoded, so an existing installation keeps working until someone saves the config screen.

### Permissions

The plugin declares the [`currentUserAccessToken`](https://www.datocms.com/docs/plugin-sdk/additional-permissions) permission, which it needs to read existing demo landing pages through the Content Management API.

Because this is a **private** plugin, declaring it in `package.json` is not enough — the permission also has to be granted for the installed plugin from the DatoCMS interface. Without it the limit check cannot run: the plugin warns the editor and lets the record through rather than blocking on a check it could not perform.

### Rolling out the demo landing page limit

The limit check could never run before the plugin declared the permission above, so it starts enforcing against content that has never been constrained by it. Turn it on in two steps:

1. Grant the permission and leave the enforcement switch **off**. Editors get a warning when a publish would exceed the limit, and nothing is blocked.
2. Once the warnings look right, turn the switch **on** to refuse those publishes. No redeploy needed — it is a plugin parameter.

The plugin always fails open: if the limit cannot be verified (permission missing, API error) the record is published with a warning. Publishing is only ever refused on a confirmed violation.

## Description

This plugin adds the following functionality.

### Forms

- Adds a "Forms" tab to the Top Menu that can be used to access "Form related" tools.
  - The first tool `Campaign Search` allows users to search `Lead Generation Form` Models that contain a specific `marketing_form_campaign` value.
  - The second tool `Issue Scanner`, goes through all the `Lead Generation Form` Models checking for some common issues.
- Adds a small validation when modifying a `marketing_form_campaign` field to try to avoid invalid values. 

The plugin can be easily extended to further tailor to the Factorial needs.

#### Known limitations
- This is not a true validation, the plugin has no way to prevent the user from saving. This may change in the future with updates to the Dato Plugin SDK.
- The validation does not work when the modal is closed right after saving. This is specially a problem because some DatoCMS views close by default after saving.

### Search & Replace

Adds a "Search & Replace" tab to the Top Menu for replacing inline text across a
specific list of pages.

- You give it a **model** to search in, the text to **find**, its **replacement**,
  and a list of **page URLs**, one per line.
- The locale of each page is derived from its URL — the market's TLD
  (`factorial.ke` → `en_ke`) or its path prefix on the consolidated domain
  (`factorial.com/el/...` → `el`). Only that locale is touched.
- URLs containing `/blog` are skipped: that content lives in WordPress.
- It searches text and multi-line text fields, slugs, SEO titles and
  descriptions, structured text (both the prose and the URLs of link nodes),
  and recurses into modular-content and single-block blocks.
- **Dry run first.** Nothing is written until you say so. Every occurrence is
  listed with its field path and surrounding text, and can be deselected
  individually, applied one page at a time, or applied all at once.
- Records are saved as drafts. Republishing is opt-in, and only applies to pages
  that were fully published — a page with unpublished draft changes is always
  left as a draft.

Replacements are written with the record version read during the dry run, so a
page edited by someone else in the meantime is rejected rather than overwritten.

**Restricting access.** The plugin's settings screen has a "Search & Replace
roles" field taking comma-separated role IDs. Leave it empty to allow every
role; list one or more to show the tab only to them. The project owner, and
anyone whose role can edit models and plugins (`can_edit_schema` — DatoCMS's own
permission for managing plugins, and the same one that gates this settings
screen), always keep access, so the administrators responsible for the setting
cannot be locked out of it. Note this hides the tool from the UI — it is not a
permission boundary, since anyone who can already edit those records can change
them by other means. Use DatoCMS role permissions for actual enforcement.

#### Known limitations
- A page is matched to a record by its slug (following the parent chain for
  nested pages). Models without a slug field cannot be targeted by URL.
- Role restriction is UI-level only, see above.
- The market table in `src/entrypoints/searchReplace/marketLocale.ts` mirrors
  `webpage/lib/market/locale-map.ts` in the monorepo, and must be kept in sync
  when a market is added or migrated to the consolidated domain.

### Landing Page Alert
Adds an alert for Demo Landing Page model in case the limits of variant are exceeded.

## References

[More information about the Dato Plugin SDK](https://www.datocms.com/docs/plugin-sdk)

[Configuring plugin to test inside Dato](https://www.datocms.com/docs/plugin-sdk/build-your-first-plugin)
