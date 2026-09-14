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
pnpm build       # typecheck + production build into build/
pnpm preview     # serve the production build locally
pnpm test        # run the Vitest suite once
pnpm test:watch  # run Vitest in watch mode
pnpm typecheck   # tsc --noEmit
```

## Configuration

Settings live on the plugin's own details page in DatoCMS (Settings → Plugins → Factorial Dato Plugin), rendered by the `renderConfigScreen` hook. They are stored as [plugin parameters](https://www.datocms.com/docs/plugin-sdk/config-screen) and propagate to all users in real time, so changing one does not require a rebuild or redeploy.

| Setting | Purpose |
| --- | --- |
| Live preview base URL | Front-end that renders the "Live preview" sidebar. Empty (the default) hides the preview. |
| Demo landing page model ID | Model whose published control/variant pages are checked against the limit. |
| Form template model ID | Model that gets the form fields validation addon. |
| Form fields field API key | Field on that model the addon attaches to. |

Every setting except the preview URL falls back to the value the plugin previously hardcoded, so an existing installation keeps working until someone saves the config screen.

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

### Landing Page Alert
Adds an alert for Demo Landing Page model in case the limits of variant are exceeded.

## References

[More information about the Dato Plugin SDK](https://www.datocms.com/docs/plugin-sdk)

[Configuring plugin to test inside Dato](https://www.datocms.com/docs/plugin-sdk/build-your-first-plugin)
