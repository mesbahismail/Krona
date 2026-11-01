'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { Box, Button, Option, Select, Typography } from '@mui/joy';
import { Download } from 'lucide-react';
import TeamAppShell from '@/components/teams/TeamAppShell';
import { PerformanceReport } from '@/components/performance/PerformanceReport';
import { useTeamMode } from '@/components/teams/TeamModeContext';
import { fetchOrgMembers, organizationMemberLabel } from '@/lib/teams/org';
import type { OrganizationMember } from '@/lib/teams/types';
import {
	emptyTeamMetricsForPeriod,
	fetchTeamPerformanceCoreMetrics,
	fetchTeamPerformanceExtendedMetrics,
	mergePerformanceMetrics,
	type PerformanceMetrics,
	type PerformancePeriodKey,
	type TeamPerformanceChartMember,
} from '@/lib/performanceData';
import { exportTeamPerformanceReview } from '@/lib/teams/exportTeamPerformance';
import { fetchTeamInsightTips } from '@/lib/teams/teamInsights';
import {
	kronaDropdownControlSx,
	kronaMenuItemSx,
	kronaSecondaryButtonSx,
	kronaSelectSlotProps,
} from '@/lib/kronaStyles';

const ALL_MEMBERS = 'all';

function memberLabel(member: OrganizationMember) {
	return organizationMemberLabel(member);
}

function memberFirstName(member: OrganizationMember): string {
	const label = organizationMemberLabel(member);
	if (label.includes('@')) return label.split('@')[0] || label;
	return label.split(/\s+/)[0] || label;
}

function chartMembersFor(
	members: OrganizationMember[],
	memberId: string,
): TeamPerformanceChartMember[] {
	const scoped =
		memberId === ALL_MEMBERS
			? members
			: members.filter((member) => member.userId === memberId);
	return scoped.map((member) => ({
		userId: member.userId,
		label: memberFirstName(member),
	}));
}

function MemberFilterSelect({
	value,
	members,
	onChange,
}: {
	value: string;
	members: OrganizationMember[];
	onChange: (memberId: string) => void;
}) {
	const selectedMember =
		value === ALL_MEMBERS
			? undefined
			: members.find((member) => member.userId === value);
	const selectedLabel = selectedMember
		? memberLabel(selectedMember)
		: 'All members';
	const measureRef = React.useRef<HTMLSpanElement>(null);
	const [width, setWidth] = React.useState<number | undefined>();

	React.useLayoutEffect(() => {
		const el = measureRef.current;
		if (!el) return;
		setWidth(Math.ceil(el.getBoundingClientRect().width) + 44);
	}, [selectedLabel]);

	return (
		<Box sx={{ position: 'relative', width: 'max-content', maxWidth: '100%' }}>
			<Box
				component="span"
				ref={measureRef}
				aria-hidden
				sx={{
					position: 'absolute',
					visibility: 'hidden',
					pointerEvents: 'none',
					whiteSpace: 'nowrap',
					fontFamily: 'Poppins, sans-serif',
					fontSize: 'var(--krona-control-font-size)',
					fontWeight: 600,
					lineHeight: 1.25,
				}}
			>
				{selectedLabel}
			</Box>
			<Select
				size="sm"
				value={value}
				onChange={(_, next) => {
					onChange(
						next && String(next).length ? String(next) : ALL_MEMBERS,
					);
				}}
				sx={{
					...kronaDropdownControlSx,
					'--Select-minHeight': 'var(--krona-control-height)',
					'--Select-minWidth': '0px',
					width: width ?? 'auto',
					minWidth: 0,
					maxWidth: '100%',
					height: 'var(--krona-control-height)',
					minHeight: 'var(--krona-control-height)',
					maxHeight: 'var(--krona-control-height)',
					boxSizing: 'border-box',
					'& .MuiSelect-button': {
						width: '100%',
						whiteSpace: 'nowrap',
						overflow: 'hidden',
						textOverflow: 'ellipsis',
					},
				}}
				slotProps={kronaSelectSlotProps}
				aria-label="Filter performance by team member"
			>
				<Option value={ALL_MEMBERS} sx={kronaMenuItemSx}>
					All members
				</Option>
				{members.map((member) => {
					const label = memberLabel(member);
					return (
						<Option
							key={member.userId}
							value={member.userId}
							label={label}
							sx={kronaMenuItemSx}
						>
							{label}
						</Option>
					);
				})}
			</Select>
		</Box>
	);
}

export default function TeamPerformancePage() {
	return (
		<React.Suspense fallback={null}>
			<TeamPerformanceContent />
		</React.Suspense>
	);
}

function TeamPerformanceContent() {
	const { organization, isManager } = useTeamMode();
	const searchParams = useSearchParams();
	const memberFromQuery = searchParams.get('member');
	const [selectedPeriod, setSelectedPeriod] =
		React.useState<PerformancePeriodKey>('week');
	const [selectedMemberId, setSelectedMemberId] =
		React.useState<string>(ALL_MEMBERS);
	const [members, setMembers] = React.useState<OrganizationMember[]>([]);
	const [metricsCache, setMetricsCache] = React.useState<
		Partial<Record<string, PerformanceMetrics>>
	>({});
	const [loadingKeys, setLoadingKeys] = React.useState<Set<string>>(
		() => new Set(),
	);
	const [insightTips, setInsightTips] = React.useState<string[]>([]);

	const metricsCacheRef = React.useRef(metricsCache);
	const selectedPeriodRef = React.useRef(selectedPeriod);
	const selectedMemberIdRef = React.useRef(selectedMemberId);
	const loadIdRef = React.useRef<Partial<Record<string, number>>>({});
	const inFlightRef = React.useRef<Partial<Record<string, boolean>>>({});
	const orgIdRef = React.useRef<string | null>(null);
	const membersRef = React.useRef<OrganizationMember[]>([]);

	const cacheKeyFor = React.useCallback(
		(period: PerformancePeriodKey, memberId: string) =>
			`${memberId}:${period}`,
		[],
	);

	React.useLayoutEffect(() => {
		metricsCacheRef.current = metricsCache;
		selectedPeriodRef.current = selectedPeriod;
		selectedMemberIdRef.current = selectedMemberId;
		orgIdRef.current = organization?.id ?? null;
		membersRef.current = members;
	}, [
		metricsCache,
		selectedPeriod,
		selectedMemberId,
		organization?.id,
		members,
	]);

	React.useEffect(() => {
		if (!organization) return;
		void (async () => {
			const list = await fetchOrgMembers(organization.id);
			setMembers(list);
			setSelectedMemberId((prev) => {
				if (prev === ALL_MEMBERS) return prev;
				return list.some((m) => m.userId === prev) ? prev : ALL_MEMBERS;
			});
		})();
	}, [organization]);

	React.useEffect(() => {
		if (!memberFromQuery) return;
		setSelectedMemberId((prev) => {
			if (!members.some((member) => member.userId === memberFromQuery)) {
				return prev;
			}
			return memberFromQuery;
		});
	}, [memberFromQuery, members]);

	const resolveUserIds = React.useCallback((memberId: string) => {
		const list = membersRef.current;
		if (memberId === ALL_MEMBERS) return list.map((m) => m.userId);
		return list.some((m) => m.userId === memberId) ? [memberId] : [];
	}, []);

	const loadPeriod = React.useCallback(
		async (period: PerformancePeriodKey, memberId: string) => {
			const key = cacheKeyFor(period, memberId);
			if (inFlightRef.current[key]) return;
			const orgId = orgIdRef.current;
			if (!orgId) return;

			inFlightRef.current[key] = true;
			const loadId = (loadIdRef.current[key] ?? 0) + 1;
			loadIdRef.current[key] = loadId;

			if (!metricsCacheRef.current[key]) {
				setLoadingKeys((prev) => {
					const next = new Set(prev);
					next.add(key);
					return next;
				});
			}

			try {
				const ids = resolveUserIds(memberId);
				const chartMembers = chartMembersFor(membersRef.current, memberId);
				if (!ids.length) {
					if (loadId !== loadIdRef.current[key]) return;
					setMetricsCache((prev) => ({
						...prev,
						[key]: emptyTeamMetricsForPeriod(period, chartMembers),
					}));
					return;
				}

				const core = await fetchTeamPerformanceCoreMetrics(period, ids, {
					chartMembers,
				});
				if (loadId !== loadIdRef.current[key]) return;

				const visible = metricsCacheRef.current[key];
				if (visible?.extendedReady) {
					setMetricsCache((prev) => ({
						...prev,
						[key]: mergePerformanceMetrics(core, {
							tasksFinished: visible.tasksFinished,
							bestFocusPeriod: visible.bestFocusPeriod,
							activityByHour: visible.activityByHour,
							taskBreakdown: visible.taskBreakdown,
							extendedReady: true,
						}),
					}));
				} else {
					setMetricsCache((prev) => ({
						...prev,
						[key]: {
							...core,
							extendedReady: false,
							taskBreakdown: null,
						},
					}));
				}

				setLoadingKeys((prev) => {
					const next = new Set(prev);
					next.delete(key);
					return next;
				});

				const extended = await fetchTeamPerformanceExtendedMetrics(
					period,
					ids,
					{
						organizationId: orgId,
						memberLabels: chartMembers,
					},
				);
				if (loadId !== loadIdRef.current[key]) return;

				setMetricsCache((prev) => ({
					...prev,
					[key]: mergePerformanceMetrics(core, extended),
				}));
			} catch (err) {
				console.warn('[team/performance] load failed', err);
				if (loadId !== loadIdRef.current[key]) return;
				setMetricsCache((prev) => ({
					...prev,
					[key]: emptyTeamMetricsForPeriod(
						period,
						chartMembersFor(membersRef.current, memberId),
					),
				}));
			} finally {
				inFlightRef.current[key] = false;
				setLoadingKeys((prev) => {
					const next = new Set(prev);
					next.delete(key);
					return next;
				});
			}
		},
		[cacheKeyFor, resolveUserIds],
	);

	React.useEffect(() => {
		if (!organization || !members.length) return;
		void loadPeriod(selectedPeriod, selectedMemberId);
	}, [
		organization,
		members,
		selectedPeriod,
		selectedMemberId,
		loadPeriod,
	]);

	React.useEffect(() => {
		if (!organization || !members.length) return;
		const ids =
			selectedMemberId === ALL_MEMBERS
				? members.map((m) => m.userId)
				: [selectedMemberId];
		let cancelled = false;
		void fetchTeamInsightTips({
			organizationId: organization.id,
			period: selectedPeriod,
			memberIds: ids,
			members,
		}).then((tips) => {
			if (!cancelled) setInsightTips(tips);
		});
		return () => {
			cancelled = true;
		};
	}, [organization, members, selectedPeriod, selectedMemberId]);

	const activeKey = cacheKeyFor(selectedPeriod, selectedMemberId);
	const metrics = metricsCache[activeKey];
	const chartLoading =
		loadingKeys.has(activeKey) || (!metrics && members.length > 0);
	const selectedMemberLabel =
		selectedMemberId === ALL_MEMBERS
			? 'All members'
			: organizationMemberLabel(
					members.find((member) => member.userId === selectedMemberId),
				);
	const todayBarCount =
		selectedMemberId === ALL_MEMBERS ? Math.max(members.length, 1) : 1;

	const exportReview = () => {
		if (!metrics) return;
		exportTeamPerformanceReview({
			period: selectedPeriod,
			memberLabel: selectedMemberLabel,
			metrics,
			insights: insightTips,
		});
	};

	return (
		<TeamAppShell title="Team Performance" fillViewport contentScroll>
			{!isManager ? (
				<Box
					sx={{
						flex: 1,
						display: 'grid',
						placeItems: 'center',
						px: 2,
						textAlign: 'center',
					}}
				>
					<Typography level="body-md" sx={{ color: 'var(--krona-text-muted)' }}>
						Team Performance is available to managers and owners.
					</Typography>
				</Box>
			) : (
				<PerformanceReport
					metrics={metrics}
					selectedPeriod={selectedPeriod}
					onPeriodChange={setSelectedPeriod}
					chartLoading={chartLoading}
					tipsUnlocked
					emptyHints={{
						tipsTitle: 'Team insights',
						tasksWorked:
							'No task time in this period. Hours appear when teammates run the work timer on a task.',
					}}
					insightTips={insightTips}
					periods={['today', 'week', 'month', 'quarter', 'year']}
					chartBarCountHint={
						selectedPeriod === 'today' ? todayBarCount : undefined
					}
					toolbarStart={
						<MemberFilterSelect
							value={selectedMemberId}
							members={members}
							onChange={setSelectedMemberId}
						/>
					}
					toolbarEnd={
						<Button
							size="sm"
							variant="plain"
							startDecorator={<Download size={15} aria-hidden />}
							onClick={exportReview}
							disabled={!metrics}
							sx={{
								...kronaSecondaryButtonSx,
								width: 'auto',
								minWidth: 0,
								px: 1.75,
							}}
						>
							Export
						</Button>
					}
				/>
			)}
		</TeamAppShell>
	);
}
