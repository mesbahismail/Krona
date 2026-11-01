'use client';

import * as React from 'react';
import { usePomodoroTimer } from '@/components/PomodoroContext';
import { useAppRuntimeActive } from '@/app/AppRuntimeActiveContext';
import { useTeamMode } from '@/components/teams/TeamModeContext';
import { showKronaBrowserNotification } from '@/lib/browserNotifications';
import { todayDateKey } from '@/lib/challenges';
import { showKronaToast } from '@/lib/kronaToast';
import { secondsToDisplayHours } from '@/lib/taskTime';
import {
	REST_NEEDED_SECONDS,
	RUNAWAY_WORK_SECONDS,
} from '@/lib/teams/timerRunawayScan';
import {
	clearTimerPresence,
	heartbeatTimerPresence,
	upsertTimerPresence,
	type TeamTimerPresenceMode,
} from '@/lib/teams/timerPresence';

const WORK_STRETCH_STARTED_KEY = 'krona-work-stretch-started-at';

function toastOnceKey(kind: 'rest' | 'runaway', dateKey: string) {
	return `krona-timer-${kind}-toast-${dateKey}`;
}

function alreadyToasted(kind: 'rest' | 'runaway', dateKey: string): boolean {
	try {
		return window.localStorage.getItem(toastOnceKey(kind, dateKey)) === '1';
	} catch {
		return false;
	}
}

function markToasted(kind: 'rest' | 'runaway', dateKey: string) {
	try {
		window.localStorage.setItem(toastOnceKey(kind, dateKey), '1');
	} catch {
		/* ignore quota */
	}
}

function presenceMode(
	running: boolean,
	mode: 'work' | 'break' | 'longBreak',
): TeamTimerPresenceMode | null {
	if (!running) return null;
	return mode === 'work' ? 'work' : 'rest';
}

/** Publishes this user's live Work/Rest timer so managers can show a badge. */
export default function TeamTimerPresenceSync() {
	const runtimeActive = useAppRuntimeActive();
	const { hasTeam, loading } = useTeamMode();
	const { running, mode } = usePomodoroTimer();
	const kind = presenceMode(running, mode);

	React.useEffect(() => {
		if (!runtimeActive) {
			void clearTimerPresence();
			return;
		}
		if (loading) return;
		if (!hasTeam || !kind) {
			void clearTimerPresence();
			return;
		}

		void upsertTimerPresence(kind);
		const id = window.setInterval(() => {
			void heartbeatTimerPresence(kind);
		}, 20_000);

		const onHide = () => {
			if (document.visibilityState === 'hidden') {
				void heartbeatTimerPresence(kind);
			}
		};
		document.addEventListener('visibilitychange', onHide);

		return () => {
			window.clearInterval(id);
			document.removeEventListener('visibilitychange', onHide);
		};
	}, [hasTeam, kind, loading, runtimeActive]);

	React.useEffect(() => {
		if (!runtimeActive || !hasTeam || kind !== 'work') {
			try {
				window.sessionStorage.removeItem(WORK_STRETCH_STARTED_KEY);
			} catch {
				/* ignore */
			}
			return;
		}
		try {
			if (!window.sessionStorage.getItem(WORK_STRETCH_STARTED_KEY)) {
				window.sessionStorage.setItem(
					WORK_STRETCH_STARTED_KEY,
					String(Date.now()),
				);
			}
		} catch {
			/* ignore */
		}

		const remindIfNeeded = () => {
			let started = 0;
			try {
				started = Number(
					window.sessionStorage.getItem(WORK_STRETCH_STARTED_KEY) ?? 0,
				);
			} catch {
				started = 0;
			}
			if (!Number.isFinite(started) || started <= 0) return;
			const elapsed = Math.max(0, Math.round((Date.now() - started) / 1000));
			const dateKey = todayDateKey();
			const hours = `${secondsToDisplayHours(elapsed)}h`;
			if (elapsed >= RUNAWAY_WORK_SECONDS) {
				if (alreadyToasted('runaway', dateKey)) return;
				markToasted('runaway', dateKey);
				const title = "Don't leave the timer running";
				const body = `You've tracked over 8h this stretch (${hours}). Leaving Krona running indefinitely inflates performance, task assignment, and time assignment. Pause the timer.`;
				showKronaToast(`${title} — ${body}`, { duration: 10_000 });
				showKronaBrowserNotification('session', {
					title,
					body,
					tag: `timer-runaway-${dateKey}`,
					href: '/timer',
				});
				return;
			}
			if (elapsed >= REST_NEEDED_SECONDS) {
				if (alreadyToasted('rest', dateKey)) return;
				markToasted('rest', dateKey);
				const title = 'You need a rest';
				const body = `Your work timer has been running for ${hours} without a break. Pause or start rest so time stays accurate.`;
				showKronaToast(`${title} — ${body}`, { duration: 8_000 });
				showKronaBrowserNotification('session', {
					title,
					body,
					tag: `timer-rest-${dateKey}`,
					href: '/timer',
				});
			}
		};

		remindIfNeeded();
		const id = window.setInterval(remindIfNeeded, 30_000);
		return () => window.clearInterval(id);
	}, [hasTeam, kind, runtimeActive]);

	return null;
}
