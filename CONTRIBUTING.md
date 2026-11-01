# Contributing to Krona

Read the [personal-use license](LICENSE) before using or contributing to the template. Contributions should be original work that you are authorized to share under the same terms. Third-party dependencies retain their own licenses.

## Local workflow

1. Create a branch for a focused change.
2. Install with `npm ci` and run `npm run dev`.
3. Check both light and dark appearances and the relevant desktop/mobile layouts.
4. Run `npm run typecheck`, `npm test`, and `npm run build`.
5. Run ESLint on changed files; distinguish existing repository findings from new ones.
6. Open a pull request describing the behavior changed and the checks performed.

Reuse the shared style tokens and components rather than adding competing card or control styles. Keep the freebie usable without environment variables or a backend. Preserve local edits when changing sample-data initialization.

For bug reports, include the route, reproduction steps, expected result, actual result, browser, and relevant console error. Use fictional data and remove personal information from screenshots and logs.

Do not commit credentials, `.env` files, browser-storage exports, dependencies, or build output.
