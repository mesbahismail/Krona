'use client';

import * as React from 'react';
import { localData } from '@/lib/localData';
import {
	aggregateProgressPercent,
	ensureRepeatDailyFocusChallenge,
	ensureRepeatDailyRestChallenge,
	ensureRepeatDailyTasksChallenge,
	ensureWorkHoursFocusChallenge,
	fetchDailyChallenges,
	getTodayChallenges,
	syncDailyChallengeProgress,
	todayDateKey,
	type DailyChallenge,
} from '@/lib/challenges';
import { useAppRuntimeActive } from '@/app/AppRuntimeActiveContext';

type ReloadOptions = {
	fetchOnly?: boolean;
};

type ChallengesSyncState = {
	challenges: DailyChallenge[];
	progress: number;
	loading: boolean;
	reload: (options?: ReloadOptions) => Promise<void>;
};

const ChallengesSyncContext = React.createContext<ChallengesSyncState | null>(null);

/** Work Free flushes many short sessions — debounce harder than tasks events. */
const EVENT_REFETCH_DEBOUNCE_MS = 450;

let syncPromise: Promise<void> | null = null;

async function syncChallengesOnce(userId: string): Promise<void> {
	if (syncPromise) return syncPromise;
	syncPromise = Promise.all([
		syncDailyChallengeProgress(undefined, { userId }),
		ensureRepeatDailyFocusChallenge({ userId }),
		ensureWorkHoursFocusChallenge({ userId }),
		ensureRepeatDailyRestChallenge({ userId }),
		ensureRepeatDailyTasksChallenge({ userId }),
	])
		.then(() => undefined)
		.finally(() => {
			syncPromise = null;
		});
	return syncPromise;
}

async function fetchChallengesForUser(userId: string): Promise<DailyChallenge[]> {
	return fetchDailyChallenges({ userId });
}

export function useChallengesSync(): ChallengesSyncState {
	const ctx = React.useContext(ChallengesSyncContext);
	if (!ctx) {
		throw new Error('useChallengesSync must be used within ChallengesSyncProvider');
	}
	return ctx;
}

export function useChallengesSyncOptional(): ChallengesSyncState | null {
	return React.useContext(ChallengesSyncContext);
}

export function ChallengesSyncProvider({ children }: { children: React.ReactNode }) {
	const runtimeActive = useAppRuntimeActive();
	const [challenges, setChallenges] = React.useState<DailyChallenge[]>([]);
	const [loading, setLoading] = React.useState(true);
	const [dateKey, setDateKey] = React.useState(todayDateKey);
	const userIdRef = React.useRef<string | null>(null);
	const reloadDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
	const initialLoadDoneRef = React.useRef(false);

	const reload = React.useCallback(async (options?: ReloadOptions) => {
		const { data: userRes } = await localData.auth.getUser();
		const user = userRes.user;
		if (!user) {
			userIdRef.current = null;
			setChallenges([]);
			setLoading(false);
			return;
		}
		userIdRef.current = user.id;
		setDateKey(todayDateKey());

		const fetchOnly = Boolean(options?.fetchOnly);
		const isInitial = !initialLoadDoneRef.current;

		// First paint: read challenges immediately so the dashboard isn't stuck
		// behind focus/rest session merges added with Work Free.
		if (isInitial || fetchOnly) {
			setChallenges(await fetchChallengesForUser(user.id));
			setLoading(false);
			initialLoadDoneRef.current = true;
		}

		if (fetchOnly) return;

		await syncChallengesOnce(user.id);
		setChallenges(await fetchChallengesForUser(user.id));
		setLoading(false);
		initialLoadDoneRef.current = true;
	}, []);

	React.useEffect(() => {
		if (!runtimeActive) return;
		void reload();
	}, [reload, runtimeActive]);

	// After midnight (or when returning to a tab left open overnight), rematerialize
	// repeat_daily focus/rest goals for the new calendar day — fetchOnly skips ensure.
	React.useEffect(() => {
		if (!runtimeActive) return;
		const lastDateKeyRef = { current: todayDateKey() };
		const rematerializeIfDayChanged = () => {
			const nextKey = todayDateKey();
			if (nextKey === lastDateKeyRef.current) return;
			lastDateKeyRef.current = nextKey;
			setDateKey(nextKey);
			void reload();
		};
		const onVisible = () => {
			if (document.visibilityState === 'visible') rematerializeIfDayChanged();
		};
		const intervalId = window.setInterval(rematerializeIfDayChanged, 60_000);
		document.addEventListener('visibilitychange', onVisible);
		window.addEventListener('focus', rematerializeIfDayChanged);
		return () => {
			window.clearInterval(intervalId);
			document.removeEventListener('visibilitychange', onVisible);
			window.removeEventListener('focus', rematerializeIfDayChanged);
		};
	}, [reload, runtimeActive]);

	React.useEffect(() => {
		if (!runtimeActive) return;
		const onChallengesUpdated = () => {
			void reload({ fetchOnly: true });
		};
		const onTasksOrSessionsUpdated = () => {
			if (reloadDebounceRef.current) {
				clearTimeout(reloadDebounceRef.current);
			}
			reloadDebounceRef.current = setTimeout(() => {
				reloadDebounceRef.current = null;
				void reload();
			}, EVENT_REFETCH_DEBOUNCE_MS);
		};

		const onTasksOrSessionsUpdatedImmediate = () => {
			if (reloadDebounceRef.current) {
				clearTimeout(reloadDebounceRef.current);
				reloadDebounceRef.current = null;
			}
			void reload();
		};

		window.addEventListener('krona:tasks-updated', onTasksOrSessionsUpdated);
		window.addEventListener(
			'krona:challenges-sync-now',
			onTasksOrSessionsUpdatedImmediate,
		);
		window.addEventListener('krona:sessions-updated', onTasksOrSessionsUpdated);
		window.addEventListener('krona:challenges-updated', onChallengesUpdated);
		return () => {
			if (reloadDebounceRef.current) {
				clearTimeout(reloadDebounceRef.current);
			}
			window.removeEventListener('krona:tasks-updated', onTasksOrSessionsUpdated);
			window.removeEventListener(
				'krona:challenges-sync-now',
				onTasksOrSessionsUpdatedImmediate,
			);
			window.removeEventListener('krona:sessions-updated', onTasksOrSessionsUpdated);
			window.removeEventListener('krona:challenges-updated', onChallengesUpdated);
		};
	}, [reload, runtimeActive]);

	const todayChallenges = React.useMemo(
		() => getTodayChallenges(challenges, dateKey),
		[challenges, dateKey],
	);

	const value = React.useMemo(
		() => ({
			challenges: todayChallenges,
			progress: aggregateProgressPercent(todayChallenges),
			loading,
			reload,
		}),
		[todayChallenges, loading, reload],
	);

	return (
		<ChallengesSyncContext.Provider value={value}>{children}</ChallengesSyncContext.Provider>
	);
}
