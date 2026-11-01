# Customization

## Where to make changes

| Area | Files |
| --- | --- |
| App title and metadata | `app/layout.tsx` |
| Colors, backgrounds, sidebar CSS | `app/globals.css` |
| Shared cards, controls, and list spacing | `lib/kronaStyles.ts` |
| Theme persistence and initialization | `lib/kronaTheme.ts`, `components/KronaThemeSync.tsx` |
| Navigation links and appearance button | `components/AppNavigationShell.tsx` |
| Header and profile menu | `components/Top.tsx`, `components/UserAccountControls.tsx` |
| Employee dashboard widgets | `components/dashboard/` |
| Manager pages and components | `app/team/`, `components/teams/` |
| Employee project list | `components/projects/ProjectsPageClient.tsx` |
| Reminders list | `app/reminders/page.tsx` |
| Shared list resizing | `components/krona/KronaResizableSplitLayout.tsx` |
| Performance periods and calculations | `lib/performanceData.ts` |
| Performance report presentation | `components/performance/PerformanceReport.tsx` |
| Sample workspace and identity | `lib/templateData.ts` |
| Local data adapter | `lib/localData.ts` |

## Branding and themes

Update the app metadata, logo component (`components/Logo.tsx`), and relevant assets in `public/`. Keep dark and light theme values together in `app/globals.css`. The shared `--krona-accent-stop-*` variables drive the purple-to-cyan gradient across controls, navigation, and performance bars.

Use shared styles in `lib/kronaStyles.ts` to keep cards and controls consistent. Projects and Reminders use `kronaSideListPanelSx`, `kronaSideListPanelBodySx`, and `kronaSideListCardSx`; changing these updates both lists. Keep the panel's horizontal padding equal at every breakpoint.

## Sample data

Edit `createTemplateData()` in `lib/templateData.ts` to change the fictional organization, people, projects, tasks, and activity. Preserve IDs and references between related rows. The initial local identity is Alex Morgan, and the organization is Krona Studio.

Data is seeded only once for a browser workspace. Editing the seed will not overwrite existing user changes or restore deleted examples. Test seed changes with a fresh browser profile or reset only the template store as described in [Local data](local-data.md).

## Performance ranges

`PerformancePeriodKey` and `periodStart()` define the available windows. `buildChartDaysFromTotals()` groups work and rest time into chart bars. Keep the selector, chart, averages, task counts, and exports aligned when adding another period.

Quarterly and Yearly use three and twelve calendar months including the current month, respectively. The current month's bar is partial. Daily averages count elapsed calendar days, including today, rather than dividing by the number of monthly bars.

## Extending behavior

`lib/localData.ts` mimics the query interface used by the existing screens. It is not a server or authorization layer. Any future shared-service implementation needs its own persistence, authentication, authorization, and synchronization behavior. The Manager / Employee switch alone grants no real permissions.

Keep external-service behavior out of the freebie unless you intentionally implement it. `lib/localService.ts` currently saves supported form drafts locally and reports unsupported remote actions without sending requests.
