/* eslint-disable @typescript-eslint/no-require-imports */
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { webcrypto } = require('node:crypto');
const storage = new Map();
global.crypto ??= webcrypto;
global.window = {
	localStorage: {
		getItem: (key) => storage.get(key) ?? null,
		setItem: (key, value) => storage.set(key, value),
	},
};
function load(
	file,
	resolve = (id) =>
		id === '@/lib/templateData' ? load('lib/templateData.ts') : require(id),
) {
	const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
		compilerOptions: {
			module: ts.ModuleKind.CommonJS,
			target: ts.ScriptTarget.ES2020,
		},
	}).outputText;
	const mod = { exports: {} };
	new Function('require', 'module', 'exports', source)(
		resolve,
		mod,
		mod.exports,
	);
	return mod.exports;
}
let localData;
beforeEach(() => {
	storage.clear();
	storage.set(
		'krona:local-data:v1',
		JSON.stringify({ _template: [{ version: 1 }] }),
	);
	localData = load('lib/localData.ts').localData;
});

test('local identity needs no credentials and profile changes persist', async () => {
	const { data } = await localData.auth.getUser();
	assert.ok(data.user.id);
	await localData.auth.updateUser({ data: { full_name: 'Alice' } });
	const reloaded = load('lib/localData.ts').localData;
	assert.equal(
		(await reloaded.auth.getUser()).data.user.user_metadata.full_name,
		'Alice',
	);
});

test('task create, update, sort, reload and delete persist locally', async () => {
	const {
		data: { user },
	} = await localData.auth.getUser();
	const inserted = await localData
		.from('tasks')
		.insert({ user_id: user.id, name: 'First', status: 'pending' })
		.select('*')
		.single();
	assert.equal(inserted.error, null);
	assert.ok(inserted.data.id);
	const id = inserted.data.id;
	await localData
		.from('tasks')
		.insert({ user_id: 'another-user', name: 'Other', status: 'pending' });
	await localData.from('tasks').update({ status: 'done' }).eq('id', id);
	const reloaded = load('lib/localData.ts').localData;
	const result = await reloaded
		.from('tasks')
		.select('*')
		.eq('user_id', user.id)
		.order('created_at', { ascending: false });
	assert.equal(result.data.length, 1);
	assert.equal(result.data[0].status, 'done');
	await localData.from('tasks').delete().eq('id', id);
	assert.equal(
		(await localData.from('tasks').select('*').eq('id', id)).data.length,
		0,
	);
});

test('settings upsert uses compound keys and queries execute only once', async () => {
	const query = localData
		.from('settings')
		.upsert(
			{ user_id: 'local', key: 'theme', value: 'dark' },
			{ onConflict: 'user_id,key' },
		);
	await query;
	await query;
	await localData
		.from('settings')
		.upsert(
			{ user_id: 'local', key: 'theme', value: 'light' },
			{ onConflict: 'user_id,key' },
		);
	const result = await localData.from('settings').select('*');
	assert.equal(result.data.length, 1);
	assert.equal(result.data[0].value, 'light');
});

test('missing optional records, required records and counts behave correctly', async () => {
	assert.equal(
		(await localData.from('notes').select('*').maybeSingle()).data,
		null,
	);
	assert.ok((await localData.from('notes').select('*').single()).error);
	await localData.from('notes').insert([{ name: 'One' }, { name: 'Two' }]);
	const result = await localData
		.from('notes')
		.select('*', { count: 'exact', head: true });
	assert.equal(result.count, 2);
	assert.equal(result.data, null);
});

test('storage failures are surfaced instead of claiming a successful save', async () => {
	const original = window.localStorage.setItem;
	window.localStorage.setItem = () => {
		throw new Error('Storage is full');
	};
	try {
		const result = await localData.from('tasks').insert({ name: 'Unsaved' });
		assert.equal(result.error.message, 'Storage is full');
	} finally {
		window.localStorage.setItem = original;
	}
});

test('feedback saves locally and remote-only actions make no network requests', async () => {
	const { localService } = load('lib/localService.ts', (id) =>
		id === '@/lib/localData' ? { localData } : require(id),
	);
	global.fetch = () => {
		throw new Error('Unexpected network request');
	};
	const feedback = await localService('feedback', {
		body: JSON.stringify({ message: 'My draft' }),
	});
	assert.equal(feedback.status, 200);
	assert.equal(
		(await localData.from('local_drafts').select('*').single()).data.message,
		'My draft',
	);
	const checkout = await localService('teams/checkout');
	assert.equal(checkout.status, 503);
	assert.match((await checkout.json()).error, /unavailable/);
});

test('local task reports resolve project names and assigned-task alternatives', async () => {
	const project = await localData
		.from('projects')
		.insert({ name: 'Website' })
		.select('*')
		.single();
	await localData
		.from('tasks')
		.insert({ name: 'Design', project_id: project.data.id });
	const task = await localData
		.from('tasks')
		.select('id, name, projects(name)')
		.single();
	assert.equal(task.data.projects.name, 'Website');
	assert.equal(task.data.status, 'pending');
	await localData.from('team_tasks').insert([
		{ name: 'Mine', assignee_user_id: 'me' },
		{ name: 'Project task', project_id: project.data.id },
		{ name: 'Other', assignee_user_id: 'other' },
	]);
	const result = await localData
		.from('team_tasks')
		.select('*')
		.or(
			`assignee_user_id.eq.me,project_id.in.(${project.data.id},another-project)`,
		);
	assert.deepEqual(
		result.data.map((row) => row.name),
		['Mine', 'Project task'],
	);
});
