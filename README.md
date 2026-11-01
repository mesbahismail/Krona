# Krona Studio

A free React and Next.js dashboard template for personal productivity and team interface exploration. Includes focus timers, tasks, projects, reminders, performance reports, and Employee / Manager layouts.

**Free for personal, noncommercial use. Commercial use is not permitted.** See [LICENSE](LICENSE).

## Quick start

Requires Node.js **20.9 or newer** and npm.

```sh
git clone https://github.com/mesbahismail/Krona.git
cd Krona
npm ci
npm run dev
```

Open the local URL printed in the terminal (usually `http://localhost:3000`). No account, environment variables, database, or backend setup is required. Repository access is required while this repository is private.

## Included

- Employee dashboard with a Pomodoro timer, task list, reminders, daily progress, and performance bars.
- Manager dashboard, projects, member roster, reminders, and performance reports.
- Week, Month, Quarterly, and Yearly performance selectors; Manager performance also includes Today and a member filter.
- Dark and light modes with shared purple-to-cyan accents.
- Icon sidebar, profile menu, and resizable Projects / Reminders list panels.
- Fictional Krona Studio sample data: five people, three projects, tasks, reminders, and two weeks of activity.
- Browser-local persistence for changes, settings, and timer sessions.

Switch **Manager / Employee** in the profile menu. Change appearance using the icon at the bottom of the sidebar. Resize a list panel by dragging its right edge.

Quarterly covers the current month and preceding two months; Yearly covers the current month and preceding eleven months. Both charts group tracked hours by month. Sample history covers only two weeks, so older months start empty.

## What this freebie is

Krona is a UI template with local interactions. Manager and Employee are interface modes, not authenticated accounts or enforced access roles. There is no shared database, remote synchronization, billing service, or AI service. Help and feedback forms store local drafts; they do not send messages. Team invitations and other remote operations are unavailable.

Each browser and origin has its own data. Clearing site data removes your saved changes. See [Local data](docs/local-data.md) before resetting a demo.

## Documentation

- [Setup, commands, and deployment](docs/getting-started.md)
- [Customize the UI and sample content](docs/customization.md)
- [Local data, reset, and service boundaries](docs/local-data.md)
- [Contributing](CONTRIBUTING.md)
- [Personal-use license](LICENSE)

## Development

```sh
npm run typecheck
npm test
npm run build
npm run lint
```

`npm run lint` checks the whole repository; existing lint findings are separate from the TypeScript, test, and production-build checks.

Built with Next.js, React, TypeScript, MUI Joy, Tailwind CSS, Recharts, and Lucide. Dependencies and third-party assets retain their respective licenses. Created by Amine Mesbah.
