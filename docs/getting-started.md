# Getting started

## Install and run

Use Node.js 20.9 or newer and npm. From the project root:

```sh
npm ci
npm run dev
```

Follow the URL printed by Next.js. To select a different port:

```sh
npm run dev -- --port 3003
```

The template needs no `.env.local`, API keys, sign-in, or database. The first browser visit initializes sample data automatically.

## Explore

The profile menu switches between Employee and Manager. Employee opens the personal dashboard; Manager opens the team dashboard and its projects, reminders, performance reports, and roster. All people and activity are fictional local data.

The sidebar provides navigation and the appearance switch. Projects and Reminders share list panels with an invisible resize target on the right edge. Drag that edge to change width; focus it with the keyboard and use the left/right arrow keys to resize.

Performance offers Week, Month, Quarterly, and Yearly. Quarterly includes the current month plus two earlier months, and Yearly includes the current month plus eleven earlier months. Charts show monthly totals for the longer ranges. Manager performance adds Today, member filtering, and an export action.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run typecheck` | TypeScript check without emitting files |
| `npm test` | Local data, theme, sample data, and performance tests |
| `npm run lint` | Repository-wide ESLint check |
| `npm run build` | Production build |
| `npm start` | Serve the production build |

Some repository-wide lint findings predate this template documentation. Check changed files as well as running TypeScript, tests, and the build.

## Deploy a personal demo

On a Node-compatible host, install with `npm ci`, build with `npm run build`, and serve with `npm start`. On Vercel, import the repository with its Next.js preset and use the repository root. No application secrets or environment variables are required by this version.

Hosting the app does not create shared storage: each visitor still receives an independent local workspace. A different hostname or port also means a separate browser data store. Deployment remains subject to the personal, noncommercial license.

## Troubleshooting

- **Port already in use:** use the alternate-port command above.
- **Old or edited sample data:** initialization preserves existing edits. Follow the reset instructions in [Local data](local-data.md) for a fresh demo.
- **Changes do not appear after updating:** restart the development server and refresh the page. If the build cache is stale, stop the server, remove only `.next`, and restart.
- **An older copy asks for backend environment variables:** confirm you are running the freebie template branch and its matching lockfile. This version does not require backend configuration.
- **A form does not send an email or invite:** those actions require a remote service and are unavailable in the local template.
- **Browser storage is full or disabled:** use a browser that permits local storage and smaller avatar uploads. See [Local data](local-data.md) for persistence limits.
