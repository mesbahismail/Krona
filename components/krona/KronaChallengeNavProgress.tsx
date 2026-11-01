'use client';

import * as React from 'react';
import { Box, Menu, Tooltip, Typography } from '@mui/joy';
import { Check, Trophy } from 'lucide-react';
import {
	challengeGoalTitle,
	challengeProgressLabel,
	challengeProgressPercent,
	DAILY_CHALLENGE_DESCRIPTION,
	DAILY_CHALLENGE_TITLE,
	todayChallengeDropdownState,
	type DailyChallenge,
	type TodayChallengeDropdownState,
} from '@/lib/challenges';
import { useChallengesSync } from '@/components/challenges/ChallengesSyncContext';
import { kronaMenuSx } from '@/lib/kronaStyles';

const MENU_OFFSET_PX = 12;
const NAV_CHALLENGE_WIDTH_PX = 120;

const STATE_COPY: Record<
	TodayChallengeDropdownState,
	{ title: string; description: string }
> = {
	empty: {
		title: DAILY_CHALLENGE_TITLE,
		description: 'Your Daily Challenges haven’t been set yet.',
	},
	ready: {
		title: DAILY_CHALLENGE_TITLE,
		description: 'Your Daily Challenges are ready. Start when you’re ready.',
	},
	in_progress: {
		title: DAILY_CHALLENGE_TITLE,
		description: DAILY_CHALLENGE_DESCRIPTION,
	},
	finished: {
		title: DAILY_CHALLENGE_TITLE,
		description: 'All goals completed for today.',
	},
};

function ChallengeProgressRow({
	challenge,
	finished,
}: {
	challenge: DailyChallenge;
	finished: boolean;
}) {
	const pct = challengeProgressPercent(challenge);
	const done = finished || challenge.status === 'completed';

	return (
		<Box
			sx={{
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'stretch',
				gap: 0.75,
				px: 1.25,
				py: 1.25,
				borderRadius: '16px',
			}}
		>
			<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
				<Box
					sx={{
						width: 28,
						height: 28,
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						flexShrink: 0,
						bgcolor: done
							? 'color-mix(in srgb, var(--krona-accent) 22%, transparent)'
							: 'var(--krona-progress-track)',
					}}
				>
					{done ? (
						<Check size={15} color="var(--krona-accent)" aria-hidden />
					) : (
						<Trophy size={14} color="var(--krona-text)" aria-hidden />
					)}
				</Box>
				<Box sx={{ flex: 1, minWidth: 0 }}>
					<Typography
						level="body-sm"
						sx={{
							color: 'var(--krona-text)',
							fontWeight: 600,
							overflow: 'hidden',
							textOverflow: 'ellipsis',
							whiteSpace: 'nowrap',
						}}
					>
						{challengeGoalTitle(challenge)}
					</Typography>
					<Typography level="body-xs" sx={{ color: 'var(--krona-text-muted)' }}>
						{done
							? `${challengeProgressLabel(challenge)} · Done`
							: challengeProgressLabel(challenge)}
					</Typography>
				</Box>
				<Typography
					level="body-xs"
					sx={{
						color: done
							? 'var(--krona-accent)'
							: 'var(--krona-text)',
						fontWeight: 700,
					}}
				>
					{pct}%
				</Typography>
			</Box>
			<Box
				sx={{
					height: 6,
					borderRadius: 999,
					bgcolor: 'var(--krona-progress-track)',
					overflow: 'hidden',
				}}
			>
				<Box
					sx={{
						height: '100%',
						width: `${pct}%`,
						borderRadius: 999,
						background: 'var(--krona-accent-gradient)',
						transition: 'width 0.35s ease',
					}}
				/>
			</Box>
		</Box>
	);
}

export default function KronaChallengeNavProgress() {
	const [anchorEl, setAnchorEl] = React.useState<HTMLButtonElement | null>(
		null,
	);
	const [open, setOpen] = React.useState(false);
	const [tooltipOpen, setTooltipOpen] = React.useState(false);
	const { challenges, progress, loading } = useChallengesSync();
	const dropdownState = todayChallengeDropdownState(challenges);
	const copy = STATE_COPY[dropdownState];

	React.useEffect(() => {
		if (!open) return;

		const onPointerDown = (event: PointerEvent) => {
			const target = event.target as Element | null;
			if (!target) return;
			if (anchorEl?.contains(target)) return;
			if (target.closest('[role="menu"]')) return;
			setOpen(false);
		};

		window.addEventListener('pointerdown', onPointerDown);
		return () => window.removeEventListener('pointerdown', onPointerDown);
	}, [open, anchorEl]);

	return (
		<>
			<Tooltip
				title={DAILY_CHALLENGE_TITLE}
				open={tooltipOpen}
				onOpen={() => {
					if (!open) setTooltipOpen(true);
				}}
				onClose={() => setTooltipOpen(false)}
				disableHoverListener={open}
				disableFocusListener={open}
				disableTouchListener
			>
				<Box
					component="button"
					type="button"
					ref={setAnchorEl}
					data-tour="dashboard-challenges"
					aria-label={DAILY_CHALLENGE_TITLE}
					aria-expanded={open}
					aria-haspopup="menu"
					onClick={() => {
						setTooltipOpen(false);
						setOpen((prev) => !prev);
					}}
					sx={{
						display: 'inline-flex',
						alignItems: 'center',
						justifyContent: 'center',
						width: NAV_CHALLENGE_WIDTH_PX,
						minWidth: NAV_CHALLENGE_WIDTH_PX,
						height: 'var(--krona-control-height)',
						minHeight: 'var(--krona-control-height)',
						px: 0.75,
						borderRadius: '999px',
						border: '1px solid var(--krona-secondary-border)',
						background: 'var(--krona-secondary-bg)',
						cursor: 'pointer',
						flexShrink: 0,
						position: 'relative',
						overflow: 'hidden',
						'&:hover': { opacity: 0.92 },
					}}
				>
					<Box
						sx={{
							position: 'absolute',
							inset: 0,
							width: `${progress}%`,
							background: 'var(--krona-accent-gradient)',
							opacity: 0.35,
							transition: 'width 0.35s ease',
						}}
					/>
					<Box
						sx={{
							position: 'relative',
							zIndex: 1,
							display: 'flex',
							alignItems: 'center',
							gap: 0.5,
							width: '100%',
							px: 0.25,
						}}
					>
						<Trophy size={14} color="var(--krona-text)" aria-hidden />
						<Box
							sx={{
								flex: 1,
								height: 6,
								borderRadius: 999,
								bgcolor: 'var(--krona-progress-track)',
								overflow: 'hidden',
							}}
						>
							<Box
								sx={{
									height: '100%',
									width: `${progress}%`,
									borderRadius: 999,
									background: 'var(--krona-accent-gradient)',
									transition: 'width 0.35s ease',
								}}
							/>
						</Box>
						<Typography
							level="body-xs"
							sx={{
								fontSize: 10,
								fontWeight: 700,
								color: 'var(--krona-text)',
								minWidth: 24,
								textAlign: 'right',
							}}
						>
							{loading ? '…' : `${progress}%`}
						</Typography>
					</Box>
				</Box>
			</Tooltip>

			<Menu
				anchorEl={anchorEl}
				open={open}
				onClose={() => setOpen(false)}
				placement="bottom-end"
				slotProps={{
					root: {
						modifiers: [
							{
								name: 'offset',
								options: { offset: [0, MENU_OFFSET_PX] },
							},
						],
					},
				}}
				sx={{
					...kronaMenuSx,
					zIndex: 1400,
					minWidth: 300,
					maxWidth: 360,
					p: 1,
				}}
			>
				<Box sx={{ px: 1.25, pt: 0.75, pb: 1 }}>
					<Typography level="title-sm" sx={{ color: 'var(--krona-text)' }}>
						{copy.title}
					</Typography>
					<Typography
						level="body-xs"
						sx={{ color: 'var(--krona-text-muted)', mt: 0.25 }}
					>
						{copy.description}
					</Typography>
				</Box>

				{dropdownState === 'empty' ? (
					<Box
						sx={{
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'center',
							textAlign: 'center',
							gap: 1.25,
							px: 2,
							py: 2.5,
						}}
					>
						<Trophy
							size={36}
							strokeWidth={1.25}
							color="var(--krona-text)"
							style={{ opacity: 0.48 }}
							aria-hidden
						/>
						<Typography
							level="title-sm"
							sx={{ color: 'var(--krona-text)', fontWeight: 600 }}
						>
							No challenge today
						</Typography>
						<Typography
							level="body-xs"
							sx={{ color: 'var(--krona-text-muted)', maxWidth: 240 }}
						>
							When daily hours or Daily Challenges are set, your goals will appear here.
						</Typography>
					</Box>
				) : (
					<>
						{dropdownState === 'ready' || dropdownState === 'finished' ? (
							<Box
								sx={{
									mx: 1,
									mb: 0.5,
									px: 1.25,
									py: 0.65,
												position: 'relative',
									overflow: 'hidden',
									bgcolor: 'var(--krona-secondary-bg)',
									border:
										dropdownState === 'finished'
											? '1px solid color-mix(in srgb, var(--krona-accent) 40%, transparent)'
											: '1px solid transparent',
									textAlign: 'center',
								}}
							>
								{dropdownState === 'finished' ? (
									<Box
										aria-hidden
										sx={{
											position: 'absolute',
											inset: 0,
											background: 'var(--krona-accent-gradient)',
											opacity: 0.28,
										}}
									/>
								) : null}
								<Typography
									level="body-xs"
									sx={{
										position: 'relative',
										fontWeight: 700,
										color: 'var(--krona-text)',
									}}
								>
									{dropdownState === 'finished'
										? 'Day complete'
										: 'Ready to start'}
								</Typography>
							</Box>
						) : null}
						{challenges.map((challenge: DailyChallenge) => (
							<ChallengeProgressRow
								key={challenge.id}
								challenge={challenge}
								finished={dropdownState === 'finished'}
							/>
						))}
					</>
				)}
			</Menu>
		</>
	);
}
