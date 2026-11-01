'use client';

import * as React from 'react';
import { CssVarsProvider, extendTheme } from '@mui/joy/styles';
import CssBaseline from '@mui/joy/CssBaseline';
import Box from '@mui/joy/Box';
import Background from '@/components/Background';
import Top from '@/components/Top';
import VacationModeBanner from '@/components/VacationModeBanner';
import { PerformanceReport } from '@/components/performance/PerformanceReport';
import { useVacationMode } from '@/components/VacationModeContext';
import { KRONA_JOY_PRIMARY } from '@/lib/kronaAccent';
import {
	buildWeekCoreFromPomodoro,
	emptyMetricsForPeriod,
	fetchPerformanceCoreMetrics,
	fetchPerformanceExtendedMetrics,
	invalidatePerformanceCache,
	isPerformanceCacheFresh,
	mergePerformanceMetrics,
	resolvePerformanceUserId,
	snapshotPerformanceCache,
	writePerformanceCache,
	type PerformanceMetrics,
	type PerformancePeriodKey,
	type PomodoroDaySnapshot,
} from '@/lib/performanceData';
import { usePomodoroStats } from '@/components/PomodoroContext';
import { isVacationModeActive } from '@/lib/vacationMode';

const theme = extendTheme({
	colorSchemes: {
		light: {
			palette: {
				primary: KRONA_JOY_PRIMARY,
			},
		},
		dark: {
			palette: {
				primary: KRONA_JOY_PRIMARY,
			},
		},
	},
	fontFamily: {
		display: 'Poppins, sans-serif',
		body: 'Poppins, sans-serif',
	},
});

export default function App() {
	const { active: vacationActive } = useVacationMode();
	const { last7Days } = usePomodoroStats();
	const [selectedPeriod, setSelectedPeriod] = React.useState<PerformancePeriodKey>('week');
	const [metricsCache, setMetricsCache] = React.useState<
		Partial<Record<PerformancePeriodKey, PerformanceMetrics>>
	>({});
	const [loadingPeriods, setLoadingPeriods] = React.useState<Set<PerformancePeriodKey>>(
		() => new Set(),
	);
	const [cacheReady, setCacheReady] = React.useState(false);

	const metricsCacheRef = React.useRef(metricsCache);
	const selectedPeriodRef = React.useRef(selectedPeriod);
	const userIdRef = React.useRef<string | null>(null);
	const loadIdRef = React.useRef<Partial<Record<PerformancePeriodKey, number>>>({});
	const inFlightRef = React.useRef<Partial<Record<PerformancePeriodKey, boolean>>>({});
	const pendingForceReloadRef = React.useRef<
		Partial<Record<PerformancePeriodKey, boolean>>
	>({});
	const last7DaysRef = React.useRef<PomodoroDaySnapshot[]>([]);
	const vacationActiveRef = React.useRef(vacationActive);

	React.useLayoutEffect(() => {
		metricsCacheRef.current = metricsCache;
		selectedPeriodRef.current = selectedPeriod;
		vacationActiveRef.current = vacationActive;
		last7DaysRef.current = last7Days.map((day) => ({
			key: day.key,
			work: day.work,
			rest: day.rest,
		}));
	}, [metricsCache, selectedPeriod, last7Days, vacationActive]);

	const isPeriodCacheFresh = React.useCallback((period: PerformancePeriodKey) => {
		return isPerformanceCacheFresh(period, userIdRef.current);
	}, []);

	const persistPeriodMetrics = React.useCallback(
		(
			period: PerformancePeriodKey,
			metrics: PerformanceMetrics,
			userId?: string | null,
		) => {
			if (metrics.extendedReady && userId) {
				writePerformanceCache(period, metrics, userId);
			}
			setMetricsCache((prev) => ({
				...prev,
				[period]: metrics,
			}));
		},
		[],
	);

	const paintWeekFromPomodoro = React.useCallback((period: PerformancePeriodKey) => {
		if (period !== 'week' || last7DaysRef.current.length !== 7) return false;
		const instant = buildWeekCoreFromPomodoro(last7DaysRef.current);
		if (!instant) return false;
		setMetricsCache((prev) => ({
			...prev,
			week: {
				...instant,
				trendWork: null,
				trendRest: null,
				trendAvgDaily: null,
				taskBreakdown: null,
				extendedReady: false,
			},
		}));
		return true;
	}, []);

	const loadPeriod = React.useCallback(
		async (
			period: PerformancePeriodKey,
			options?: { force?: boolean; background?: boolean },
		) => {
			const background = options?.background === true;
			if (!options?.force && isPeriodCacheFresh(period)) return;
			if (inFlightRef.current[period]) {
				if (options?.force) {
					pendingForceReloadRef.current[period] = true;
				}
				return;
			}

			if (isVacationModeActive() || vacationActiveRef.current) {
				const empty = emptyMetricsForPeriod(period);
				persistPeriodMetrics(period, empty);
				return;
			}

			inFlightRef.current[period] = true;
			const loadId = (loadIdRef.current[period] ?? 0) + 1;
			loadIdRef.current[period] = loadId;

			const hasVisibleData = Boolean(metricsCacheRef.current[period]);
			const paintedInstant =
				!options?.force && !background && paintWeekFromPomodoro(period);
			if (!paintedInstant && !background && !hasVisibleData) {
				setLoadingPeriods((prev) => {
					const next = new Set(prev);
					next.add(period);
					return next;
				});
			}

			try {
				const userId = await resolvePerformanceUserId();
				if (!userId) {
					if (loadId !== loadIdRef.current[period]) return;
					persistPeriodMetrics(period, emptyMetricsForPeriod(period));
					return;
				}

				const core = await fetchPerformanceCoreMetrics(period, {
					userId,
					pomodoroLast7Days:
						period === 'week' ? last7DaysRef.current : undefined,
				});
				if (loadId !== loadIdRef.current[period]) return;

				// Refresh core values without blanking extended widgets that have
				// already loaded. Their previous values stay visible until the new
				// extended query completes.
				const visibleMetrics = metricsCacheRef.current[period];
				if (visibleMetrics?.extendedReady) {
					const coreWithVisibleExtended = mergePerformanceMetrics(core, {
						tasksFinished: visibleMetrics.tasksFinished,
						bestFocusPeriod: visibleMetrics.bestFocusPeriod,
						activityByHour: visibleMetrics.activityByHour,
						taskBreakdown: visibleMetrics.taskBreakdown,
						extendedReady: true,
					});
					setMetricsCache((prev) => ({
						...prev,
						[period]: coreWithVisibleExtended,
					}));
				} else {
					// First load: show core cards while deferred metrics are fetched.
					persistPeriodMetrics(
						period,
						{ ...core, extendedReady: false, taskBreakdown: null },
						userId,
					);
				}
				setLoadingPeriods((prev) => {
					const next = new Set(prev);
					next.delete(period);
					return next;
				});

				const extended = await fetchPerformanceExtendedMetrics(period, userId);
				if (loadId !== loadIdRef.current[period]) return;

				persistPeriodMetrics(
					period,
					mergePerformanceMetrics(core, extended),
					userId,
				);
			} catch (error) {
				console.warn('[performance] loadPeriod failed:', period, error);
				if (loadId !== loadIdRef.current[period]) return;
				if (!background || !metricsCacheRef.current[period]) {
					persistPeriodMetrics(period, emptyMetricsForPeriod(period));
				}
			} finally {
				inFlightRef.current[period] = false;
				setLoadingPeriods((prev) => {
					const next = new Set(prev);
					next.delete(period);
					return next;
				});
				if (pendingForceReloadRef.current[period]) {
					pendingForceReloadRef.current[period] = false;
					void loadPeriod(period, { force: true, background: true });
				}
			}
		},
		[isPeriodCacheFresh, paintWeekFromPomodoro, persistPeriodMetrics],
	);

	React.useEffect(() => {
		let cancelled = false;
		void (async () => {
			const userId = await resolvePerformanceUserId();
			if (cancelled) return;
			userIdRef.current = userId;
			const snapshot = snapshotPerformanceCache(userId);
			if (Object.keys(snapshot).length > 0) {
				setMetricsCache(snapshot);
			}
			setCacheReady(true);
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	React.useEffect(() => {
		if (!cacheReady) return;
		void loadPeriod('week');
	}, [cacheReady, loadPeriod]);

	React.useEffect(() => {
		if (!cacheReady || selectedPeriod === 'week') return;
		void loadPeriod(selectedPeriod);
	}, [cacheReady, selectedPeriod, loadPeriod]);

	React.useEffect(() => {
		const refreshSelectedPeriod = () => {
			const period = selectedPeriodRef.current;
			invalidatePerformanceCache(period);
			void loadPeriod(period, { force: true, background: true });
		};

		window.addEventListener('krona:sessions-updated', refreshSelectedPeriod);
		window.addEventListener('krona:tasks-updated', refreshSelectedPeriod);
		return () => {
			window.removeEventListener(
				'krona:sessions-updated',
				refreshSelectedPeriod,
			);
			window.removeEventListener('krona:tasks-updated', refreshSelectedPeriod);
		};
	}, [isPeriodCacheFresh, loadPeriod]);

	const metrics = metricsCache[selectedPeriod] ?? null;
	const chartLoading = loadingPeriods.has(selectedPeriod) && metrics === null;

	return (
		<CssVarsProvider theme={theme}>
			<CssBaseline />
			<Box
				sx={{
					display: 'flex',
					minHeight: '100vh',
					bgcolor: 'background.body',
					position: 'relative',
					overflow: 'visible',
				}}
			>
				{/* Background Video */}
				<Background />

				{/* Sidebar */}
				{/* Main Content */}
				<Box
					className="krona-main-content"
					sx={{
						flex: 1,
						display: 'flex',
						flexDirection: 'column',
						position: 'relative',
						zIndex: 1,
						width: 'auto',
						maxWidth: 'none',
						overflowX: 'clip',
					}}
				>
					{/* Top Bar */}
					<Top title="Performance" />

					<Box
						sx={{
							flex: 1,
							display: 'flex',
							flexDirection: 'column',
							minHeight: 0,
							px: { xs: 0, md: 0 },
							pt: { xs: 2, md: 0 },
							pb: {
								xs: 'calc(var(--krona-mobile-tab-height, 81px) + env(safe-area-inset-bottom, 0px) + 16px)',
								md: 2,
							},
							boxSizing: 'border-box',
						}}
					>
						<PerformanceReport
							metrics={metrics}
							selectedPeriod={selectedPeriod}
							onPeriodChange={setSelectedPeriod}
							chartLoading={chartLoading}
						>
							<VacationModeBanner />
						</PerformanceReport>

					</Box>
				</Box>
			</Box>
		</CssVarsProvider>
	);
}
