/* eslint-disable @typescript-eslint/no-require-imports */
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const storage = new Map();
const attrs = new Map();
const classes = new Set();
const events = [];
const code = ts.transpileModule(fs.readFileSync('lib/kronaTheme.ts', 'utf8'), {
	compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const mod = { exports: {} };
new Function('module', 'exports', code)(mod, mod.exports);
const theme = mod.exports;
beforeEach(() => {
	storage.clear();
	attrs.clear();
	classes.clear();
	events.length = 0;
	global.document = {
		documentElement: {
			style: {},
			getAttribute: (key) => attrs.get(key) ?? null,
			setAttribute: (key, value) => attrs.set(key, value),
			classList: {
				add: (name) => classes.add(name),
				remove: (name) => classes.delete(name),
				toggle: (name, enabled) =>
					enabled ? classes.add(name) : classes.delete(name),
			},
		},
	};
	global.window = {
		localStorage: {
			getItem: (key) => storage.get(key) ?? null,
			setItem: (key, value) => storage.set(key, value),
		},
		dispatchEvent: (event) => events.push(event),
		clearTimeout() {},
		setTimeout() {
			return 1;
		},
	};
	global.CustomEvent = class {
		constructor(name, input) {
			this.type = name;
			this.detail = input.detail;
		}
	};
});

test('only Light and Dark are exposed; saved seasonal choices migrate', () => {
	assert.deepEqual(theme.KRONA_THEME_SEASONS, ['light', 'dark']);
	for (const old of ['winter', 'autumn', 'spring', null])
		assert.equal(theme.resolveKronaTheme(old), 'dark');
	assert.equal(theme.resolveKronaTheme('summer'), 'light');
});

test('mode changes update CSS, Joy, stored preferences and events together', () => {
	theme.applyKronaTheme('light');
	assert.equal(theme.isKronaThemeDark(), false);
	assert.equal(classes.has('dark'), false);
	assert.equal(attrs.get('data-joy-color-scheme'), 'light');
	assert.equal(document.documentElement.style.colorScheme, 'light');
	assert.equal(storage.get('krona-theme'), 'light');
	assert.equal(storage.get('joy-mode'), 'light');
	assert.equal(theme.toggleKronaTheme(), 'dark');
	assert.equal(classes.has('dark'), true);
	assert.equal(events.at(-1).detail.previous, 'light');
});

test('bootstrap restores the stored mode before rendering', () => {
	storage.set('krona-theme', 'light');
	vm.runInNewContext(theme.KRONA_THEME_INIT_SCRIPT, {
		localStorage: window.localStorage,
		document,
	});
	assert.equal(attrs.get('data-krona-season'), 'light');
	assert.equal(classes.has('dark'), false);
	assert.equal(storage.get('joy-mode'), 'light');
});

test('bootstrap safely defaults to Dark when storage is blocked', () => {
	vm.runInNewContext(theme.KRONA_THEME_INIT_SCRIPT, {
		localStorage: {
			getItem() {
				throw new Error('Blocked');
			},
			setItem() {
				throw new Error('Blocked');
			},
		},
		document,
	});
	assert.equal(attrs.get('data-krona-season'), 'dark');
	assert.equal(classes.has('dark'), true);
});
