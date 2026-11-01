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
