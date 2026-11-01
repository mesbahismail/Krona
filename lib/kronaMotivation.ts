import type { KronaWinKind } from '@/lib/kronaDataEvents';
import { showKronaSuccess } from '@/lib/kronaToast';

const DAILY_KEY = 'krona:motivation-daily';
const MAX_PER_DAY = 2;
const MIN_GAP_MS = 45_000;

const MESSAGES: Record<KronaWinKind, string[]> = {
	task_done: [
		"You're out there being awesome.",
		'Task down — look at you go.',
		'That’s a real win. Keep rolling.',
		'Nice finish. Momentum looks good on you.',
		'Checked off and crushing it.',
	],
	project_created: [
		'New project, new energy — you’ve got this.',
		'Fresh project unlocked. You’re building something.',
		'Starting strong. Love that.',
		'Project planted. Now watch it grow.',
	],
	routine_saved: [
		'Routine locked in — future-you says thanks.',
		'You just designed a better day.',
		'Structure looks good on you.',
		'Routine saved. Consistency starts here.',
	],
};

function todayKey(): string {
	const d = new Date();
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

type DailyState = { date: string; count: number; lastAt: number };

function readDaily(): DailyState {
	try {
		const raw = localStorage.getItem(DAILY_KEY);
		if (!raw) return { date: todayKey(), count: 0, lastAt: 0 };
		const parsed = JSON.parse(raw) as Partial<DailyState>;
		if (parsed?.date !== todayKey()) {
			return { date: todayKey(), count: 0, lastAt: 0 };
		}
		return {
			date: todayKey(),
			count: typeof parsed.count === 'number' ? Math.max(0, parsed.count) : 0,
			lastAt: typeof parsed.lastAt === 'number' ? parsed.lastAt : 0,
		};
	} catch {
		return { date: todayKey(), count: 0, lastAt: 0 };
	}
}

function writeDaily(state: DailyState) {
	try {
		localStorage.setItem(DAILY_KEY, JSON.stringify(state));
	} catch {
		/* ignore */
	}
}

function pickMessage(kind: KronaWinKind): string {
	const list = MESSAGES[kind];
	return list[Math.floor(Math.random() * list.length)] ?? list[0]!;
}

/** Show a short motivational toast if under the daily cap. */
export function maybeShowMotivationalWin(kind: KronaWinKind): boolean {
	if (typeof window === 'undefined') return false;
	const state = readDaily();
	if (state.count >= MAX_PER_DAY) return false;
	const now = Date.now();
	if (state.lastAt && now - state.lastAt < MIN_GAP_MS) return false;

	// Reserve the daily slot immediately so rapid wins don't double-fire.
	writeDaily({ date: todayKey(), count: state.count + 1, lastAt: now });

	window.setTimeout(() => {
		showKronaSuccess(pickMessage(kind), { duration: 4200 });
	}, 1100);
	return true;
}
