import { defineConfig } from 'oxlint'
import core from 'ultracite/oxlint/core'
import react from 'ultracite/oxlint/react'
import vitest from 'ultracite/oxlint/vitest'

// Mirrors the webpage's oxlint setup (ultracite presets + its "off for good"
// list), with three differences:
//   - `next` is swapped for `vitest`: this is a Vite/DatoCMS plugin, not Next.
//   - No fix-on-touch warn list. That exists to keep a large legacy codebase
//     green; this repo starts clean, so rules keep their preset severity.
//   - jsx-a11y rules stay on. The webpage turns them off pending its own
//     accessibility pass; there is no such debt to grandfather in here.
//
// Not .ts (that loader needs a newer Node than CI pins) and never
// auto-discovered, so every invocation passes `-c`.

export default defineConfig({
  extends: [core, react, vitest],
  ignorePatterns: [...core.ignorePatterns, 'build'],
  rules: {
    // Off for good: old exceptions, style churn, and refactors too big to ask
    // for on touch. Kept in sync with the webpage's list.
    'eslint/complexity': 'off',
    'eslint/func-style': 'off',
    'eslint/no-await-in-loop': 'off',
    'eslint/no-inline-comments': 'off',
    'eslint/no-nested-ternary': 'off',
    'eslint/no-plusplus': 'off',
    'eslint/no-underscore-dangle': 'off',
    'eslint/no-unused-expressions': 'off',
    'eslint/no-warning-comments': 'off',
    'eslint/prefer-arrow-callback': 'off',
    'eslint/prefer-destructuring': 'off',
    'eslint/prefer-named-capture-group': 'off',
    'eslint/require-unicode-regexp': 'off',
    'eslint/sort-keys': 'off',
    'import/no-cycle': 'off',
    'react/function-component-definition': 'off',
    'react/iframe-missing-sandbox': 'off',
    'react/react-in-jsx-scope': 'off',
    'react/todo': 'off',
    'typescript/array-type': 'off',
    'typescript/consistent-type-definitions': 'off',
    'typescript/parameter-properties': 'off',
    'unicorn/consistent-function-scoping': 'off',
    'unicorn/filename-case': 'off',
    'unicorn/no-array-for-each': 'off',
    'unicorn/no-nested-ternary': 'off',
    'unicorn/no-useless-spread': 'off',
    'unicorn/no-useless-undefined': 'off',
    'unicorn/prefer-add-event-listener': 'off',
    'unicorn/prefer-array-find': 'off',
    'unicorn/prefer-at': 'off',
    'unicorn/prefer-dom-node-dataset': 'off',
    'unicorn/prefer-query-selector': 'off',
    'unicorn/prefer-set-has': 'off',
    'unicorn/require-module-specifiers': 'off',
    'unicorn/throw-new-error': 'off',

    // The DatoCMS SDK types many ctx objects loosely and the plugin mirrors
    // that at its boundaries. Tightening those is its own piece of work.
    'typescript/no-explicit-any': 'off'
  }
})
