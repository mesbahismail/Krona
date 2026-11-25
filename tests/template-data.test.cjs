/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { webcrypto } = require('node:crypto');
global.crypto ??= webcrypto;
const cache = new Map();
function load(file) {
	const full = path.resolve(file);
	if (cache.has(full)) return cache.get(full).exports;
	const mod = { exports: {} };
	cache.set(full, mod);
	const source = ts.transpileModule(fs.readFileSync(full, 'utf8'), {
		compilerOptions: {
			module: ts.ModuleKind.CommonJS,
			target: ts.ScriptTarget.ES2020,
			jsx: ts.JsxEmit.ReactJSX,
			esModuleInterop: true,
		},
	}).outputText;
	const resolve = (id) => {
		if (!id.startsWith('@/') && !id.startsWith('.')) return require(id);
		const base = id.startsWith('@/')
			? path.resolve(id.slice(2))
			: path.resolve(path.dirname(full), id);
		const target = ['', '.ts', '.tsx', '/index.ts']
			.map((ext) => base + ext)
			.find(
				(candidate) =>
					fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
			);
		if (!target) throw new Error(`Cannot resolve ${id} from ${file}`);
		return load(target);
	};
	new Function('require', 'module', 'exports', source)(
		resolve,
		mod,
		mod.exports,
	);
	return mod.exports;
}
const { createTemplateData, withTemplateData, TEMPLATE_USER_ID } = load(
	'lib/templateData.ts',
);

test('sample workspace connects the manager roster, projects, tasks and history', () => {
	const db = createTemplateData(new Date(2026, 9, 31, 12));
	assert.equal(db.organization_members.length, 5);
	assert.equal(db.team_projects.length, 3);
	assert.equal(db.personal.length, 5);
	assert.ok(db.sessions.length >= 100);
	assert.ok(db.tasks.some((task) => task.status === 'done'));
	assert.ok(
		db.daily_challenges.every((goal) => goal.challenge_date === '2026-10-31'),
	);
	for (const task of db.team_tasks) {
		assert.ok(
			db.organization_members.some(
				(member) => member.user_id === task.assignee_user_id,
			),
		);
		assert.ok(
			db.team_projects.some((project) => project.id === task.project_id),
		);
	}
});

test('seeding preserves custom data and does not restore deleted samples', () => {
	const custom = { id: 'my-task', name: 'Keep this task' };
	const data = withTemplateData({
		tasks: [custom],
		personal: [
			{
				id: TEMPLATE_USER_ID,
				user_id: TEMPLATE_USER_ID,
				first_name: 'Taylor',
				app_settings: { workspaceMode: 'team' },
			},
		],
	});
	assert.equal(data.tasks[0], custom);
	assert.equal(data.personal[0].first_name, 'Taylor');
	assert.equal(data.personal[0].app_settings.workspaceMode, 'team');
	data.tasks = [custom];
	assert.equal(withTemplateData(data), data);
	assert.equal(data.tasks.length, 1);
});

test('manager data loaders return named people, assigned tasks and nonzero metrics locally', async () => {
	const store = new Map();
	global.window = {
		localStorage: {
			getItem: (key) => store.get(key) ?? null,
			setItem: (key, value) => store.set(key, value),
		},
		dispatchEvent() {},
		addEventListener() {},
		removeEventListener() {},
	};
	const { fetchOrgMembers } = load('lib/teams/org.ts');
	const {
		fetchTeamTasks,
		fetchTeamTodayProgress,
		fetchTeamProjectOptions,
		fetchMemberChallengeProgress,
	} = load('lib/teams/dashboard.ts');
	const members = await fetchOrgMembers('demo-studio');
	assert.equal(members.length, 5);
	assert.equal(members[0].displayName, 'Alex Morgan');
	assert.equal((await fetchTeamProjectOptions('demo-studio')).length, 3);
	assert.equal((await fetchTeamTasks('demo-studio')).length, 8);
	const progress = await fetchTeamTodayProgress('demo-studio');
	assert.equal(progress.tasksFinished, 2);
	assert.notEqual(progress.workHoursLabel, '0');
	const challenges = await fetchMemberChallengeProgress('demo-studio');
	assert.ok(challenges.some((row) => row.percent > 0));
	assert.equal(challenges.reduce((sum, row) => sum + row.workSeconds, 0), 750 * 60);
	assert.equal(challenges.reduce((sum, row) => sum + row.restSeconds, 0), 100 * 60);
	assert.equal(challenges.reduce((sum, row) => sum + row.tasksFinished, 0), 2);
	const { mergeChallengeRows } = load('lib/teams/stableLists.ts');
	const updatedEffort = challenges.map((row, index) => index === 0
		? { ...row, restSeconds: row.restSeconds + 60, tasksFinished: row.tasksFinished + 1 }
		: row);
	const mergedEffort = mergeChallengeRows(challenges, updatedEffort);
	assert.notEqual(mergedEffort[0], challenges[0]);
	assert.equal(mergedEffort[0].restSeconds, challenges[0].restSeconds + 60);
	assert.equal(mergedEffort[1], challenges[1]);
	const { fetchTeamPerformanceExtendedMetrics } = load('lib/performanceData.ts');
	const weekly = await fetchTeamPerformanceExtendedMetrics('week', members.map((member) => member.userId), { organizationId: 'demo-studio' });
	assert.equal(weekly.activityByHour.length, 12);
	assert.ok(weekly.activityByHour.some((bucket) => bucket.workHours > 0));
	const { saveUserAppSettings, loadUserAppSettings } = load(
		'lib/userAppSettings.ts',
	);
	await saveUserAppSettings(TEMPLATE_USER_ID, { workspaceMode: 'team' });
	assert.equal(
		(await loadUserAppSettings(TEMPLATE_USER_ID)).workspaceMode,
		'team',
	);
	await saveUserAppSettings(TEMPLATE_USER_ID, { workspaceMode: 'individual' });
	assert.equal(
		(await loadUserAppSettings(TEMPLATE_USER_ID)).workspaceMode,
		'individual',
	);
	const { localData } = load('lib/localData.ts');
	const { loadDashboardBundle } = load('lib/dashboard/loadDashboardData.ts');
	const employee = await loadDashboardBundle(localData, TEMPLATE_USER_ID);
	assert.equal(employee.firstName, 'Alex');
	assert.ok(employee.tasks.length >= 8);
	assert.equal(employee.notes.length, 2);
	assert.equal(employee.routine.length, 4);
	assert.ok(employee.reminders.length > 0);

	const personal = await localData
		.from('personal')
		.select('*')
		.eq('user_id', TEMPLATE_USER_ID)
		.single();
	assert.equal(personal.data.email_address, 'alex@example.com');
});

test('existing seeded Local User profiles are upgraded without reseeding content', () => {
	const existing = {
		_template: [{ version: 1 }],
		personal: [
			{
				id: TEMPLATE_USER_ID,
				user_id: TEMPLATE_USER_ID,
				first_name: 'Local',
				last_name: 'User',
			},
		],
		profiles: [{ id: TEMPLATE_USER_ID, full_name: 'Local User' }],
		tasks: [],
	};
	const updated = withTemplateData(existing);
	assert.equal(updated.personal[0].first_name, 'Alex');
	assert.equal(updated.profiles[0].full_name, 'Alex Morgan');
	assert.equal(updated.tasks.length, 0);
});

test('long performance windows handle year boundaries and leap-day totals', () => {
	const dayjs = require('dayjs');
	const { periodStart, buildChartDaysFromTotals, chartBarCount } = load('lib/performanceData.ts');
	const now = dayjs('2024-03-15T12:00:00');
	assert.equal(periodStart(now, 'quarter').format('YYYY-MM-DD'), '2024-01-01');
	assert.equal(periodStart(now, 'year').format('YYYY-MM-DD'), '2023-04-01');
	assert.equal(periodStart(dayjs('2026-01-31'), 'quarter').format('YYYY-MM-DD'), '2025-11-01');
	const totals = new Map([
		['2023-03-31', { workSeconds: 360000, restSeconds: 0 }],
		['2023-12-31', { workSeconds: 3600, restSeconds: 0 }],
		['2024-01-01', { workSeconds: 3600, restSeconds: 1800 }],
		['2024-02-28', { workSeconds: 3600, restSeconds: 0 }],
		['2024-02-29', { workSeconds: 7200, restSeconds: 1800 }],
		['2024-03-15', { workSeconds: 14400, restSeconds: 3600 }],
		['2024-03-16', { workSeconds: 360000, restSeconds: 0 }],
	]);
	const quarter = buildChartDaysFromTotals('quarter', totals, now);
	assert.deepEqual(quarter.map((bar) => bar.label), ['Jan', 'Feb', 'Mar']);
	assert.deepEqual(quarter.map((bar) => bar.workHours), [1, 3, 4]);
	assert.deepEqual(quarter.map((bar) => bar.restHours), [0.5, 0.5, 1]);
	assert.equal(quarter.length, chartBarCount('quarter'));
	const year = buildChartDaysFromTotals('year', totals, now);
	assert.equal(year.length, chartBarCount('year'));
	assert.equal(year.length, 12);
	assert.equal(year[0].label, 'Apr');
	assert.equal(year[11].label, 'Mar');
	assert.equal(year.reduce((sum, bar) => sum + bar.workHours, 0), 9);
});

test('quarterly and yearly reports load local employee and manager metrics', async () => {
	const {
		fetchPerformanceCoreMetrics,
		fetchPerformanceExtendedMetrics,
		fetchTeamPerformanceCoreMetrics,
	} = load('lib/performanceData.ts');
	for (const period of ['quarter', 'year']) {
		const expectedBars = period === 'quarter' ? 3 : 12;
		const employee = await fetchPerformanceCoreMetrics(period, { userId: TEMPLATE_USER_ID });
		assert.equal(employee.chartDays.length, expectedBars);
		assert.ok(employee.totalWorkHours > 0);
		assert.ok(employee.avgDailyWorkHours < employee.totalWorkHours);
		const chartHours = employee.chartDays.reduce((sum, bar) => sum + bar.workHours, 0);
		assert.ok(Math.abs(chartHours - employee.totalWorkHours) < 0.11);
		const details = await fetchPerformanceExtendedMetrics(period, TEMPLATE_USER_ID);
		assert.ok(details.tasksFinished > 0);
		const manager = await fetchTeamPerformanceCoreMetrics(period, [TEMPLATE_USER_ID]);
		assert.equal(manager.chartDays.length, expectedBars);
		assert.ok(manager.totalWorkHours > 0);
	}
});

test('analytics groups project time and retains members with no task activity', () => {
	const { buildAnalyticsSummary } = load('lib/analyticsSummary.ts');
	const summary = buildAnalyticsSummary({
		totalWorkHours: 6, totalRestHours: 2,
		taskBreakdown: [
			{ taskId: '1', projectName: 'Design', hours: 2, workers: [{ userId: 'a', name: 'Alex', hours: 2 }] },
			{ taskId: '2', projectName: 'Design', hours: 3, workers: [{ userId: 'a', name: 'Alex', hours: 1 }, { userId: 'b', name: 'Maya', hours: 2 }] },
			{ taskId: '3', projectName: null, hours: 1 },
		],
	}, [{ userId: 'a', label: 'Alex' }, { userId: 'b', label: 'Maya' }, { userId: 'c', label: 'Noor' }]);
	assert.equal(summary.workShare, 75);
	assert.equal(summary.projectCount, 2);
	assert.equal(summary.taskCount, 3);
	assert.deepEqual(summary.projects, [['Design', 5], ['Unassigned', 1]]);
	assert.deepEqual(summary.contributors.map((person) => [person.name, person.hours, person.tasks]), [['Alex', 3, 2], ['Maya', 2, 1], ['Noor', 0, 0]]);
	assert.equal(summary.contributors[0].share, 50);
	const empty = buildAnalyticsSummary({ totalWorkHours: 0, totalRestHours: 0, taskBreakdown: [] });
	assert.equal(empty.workShare, 0);
	assert.equal(empty.taskHours, 0);
	assert.deepEqual(empty.projects, []);
});

test('analytics day parts partition every time bucket and handle empty work', () => {
	const { buildAnalyticsSummary } = load('lib/analyticsSummary.ts');
	const summary = buildAnalyticsSummary({
		totalWorkHours: 12, totalRestHours: 3,
		taskBreakdown: [{ taskId: 'a', hours: 2 }, { taskId: 'b', hours: 4 }],
		chartDays: [
			{ label: 'Mon', workHours: 4, restHours: 1 },
			{ label: 'Tue', workHours: 0, restHours: 1 },
			{ label: 'Wed', workHours: 8, restHours: 1 },
		],
		activityByHour: Array.from({ length: 12 }, (_, index) => ({
			label: `${String(index * 2).padStart(2, '0')}:00`, workHours: 1, restHours: 0.25,
		})),
	});
	assert.equal(summary.activeBuckets, 2);
	assert.equal(summary.totalBuckets, 3);
	assert.equal(summary.busiestBucket.label, 'Wed');
	assert.equal(summary.averageTaskHours, 3);
	assert.equal(summary.breakMinutesPerWorkHour, 15);
	assert.deepEqual(summary.dayParts.map((part) => [part.workHours, part.restHours, part.share]),
		Array.from({ length: 4 }, () => [3, 0.75, 25]));
	const empty = buildAnalyticsSummary({ totalWorkHours: 0, totalRestHours: 2, chartDays: [], activityByHour: [], taskBreakdown: [] });
	assert.equal(empty.busiestBucket, null);
	assert.equal(empty.breakMinutesPerWorkHour, null);
	assert.equal(empty.averageTaskHours, 0);
	assert.ok(empty.dayParts.every((part) => part.share === 0));
});

test('employee completion counts use completion time and manager counts respect member filters', async () => {
	const { localData } = load('lib/localData.ts');
	const { fetchPerformanceExtendedMetrics, fetchTeamPerformanceExtendedMetrics } = load('lib/performanceData.ts');
	const now = new Date(Date.now() - 1000).toISOString();
	await localData.from('tasks').insert({ id: 'analytics-completion', user_id: 'analytics-user', status: 'done', completed_at: now, updated_at: '2020-01-01T00:00:00Z' });
	const employee = await fetchPerformanceExtendedMetrics('week', 'analytics-user');
	assert.equal(employee.tasksFinished, 1);
	await localData.from('team_tasks').insert([
		{ id: 'analytics-team-a', organization_id: 'analytics-org', assignee_user_id: 'analytics-a', status: 'done', completed_at: now },
		{ id: 'analytics-team-b', organization_id: 'analytics-org', assignee_user_id: 'analytics-b', status: 'done', completed_at: now },
	]);
	const selected = await fetchTeamPerformanceExtendedMetrics('week', ['analytics-a'], { organizationId: 'analytics-org' });
	assert.equal(selected.tasksFinished, 1);
	const all = await fetchTeamPerformanceExtendedMetrics('week', ['analytics-a', 'analytics-b'], { organizationId: 'analytics-org' });
	assert.equal(all.tasksFinished, 2);
});


test('portrait upgrade preserves custom photos and recorded activity', () => {
	const original = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" rx="24" fill="#534fff"/><text x="40" y="49" text-anchor="middle" font-family="sans-serif" font-size="27" fill="white">AM</text></svg>')}`;
	const custom = 'data:image/svg+xml,%3Csvg%3E%3Ctext%3EMy%20photo%3C/text%3E%3C/svg%3E';
	const existing = createTemplateData();
	existing.profiles[0].avatar_url = original;
	existing.profiles[1].avatar_url = custom;
	existing.local_identity[0].user_metadata.avatar_url = original;
	const updated = withTemplateData(existing);
	assert.equal(updated.profiles[0].avatar_url, '/portraits/alex.jpg');
	assert.equal(updated.local_identity[0].user_metadata.avatar_url, '/portraits/alex.jpg');
	assert.equal(updated.profiles[1].avatar_url, custom);
	assert.equal(updated.sessions, existing.sessions);
	assert.equal(updated.tasks, existing.tasks);
	assert.equal(updated.daily_challenges, existing.daily_challenges);
	assert.equal(withTemplateData(updated), updated);
});

test('tabbed reminders keep their height across the desktop sidebar breakpoint', () => {
	const styleFunctionSx = require('@mui/system/styleFunctionSx').default;
	const { extendTheme } = require('@mui/joy/styles');
	const { kronaStackedListPanelSx } = load('lib/kronaStyles.ts');
	const { kronaContentLayoutFromWidth } = load('lib/kronaBreakpoints.ts');
	const css = styleFunctionSx({ sx: kronaStackedListPanelSx, theme: extendTheme() });
	// Resolve the generated MUI media rules, including rules that override base flex styles.
	for (const width of [320, 620, 799, 800, 899, 900, 999, 1000, 1199, 1200]) {
		const resolved = { ...css };
		for (const [selector, rules] of Object.entries(css)) {
			const minimum = selector.match(/^@media \(min-width:(\d+)px\)$/);
			if (minimum && width >= Number(minimum[1])) Object.assign(resolved, rules);
		}
		assert.equal(resolved.flexGrow, 1, `Panel must fill remaining height at ${width}px`);
		assert.equal(resolved.height, 'auto');
		assert.equal(resolved.minHeight, 0);
		assert.equal(kronaContentLayoutFromWidth(width).isDesktopDashboard, width >= 1200);
	}
});
