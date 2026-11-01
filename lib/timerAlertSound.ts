'use client';

import { readPomodoroPreferences } from '@/lib/pomodoroPreferences';

let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
	if (typeof window === 'undefined') return null;
	try {
		if (!sharedAudioContext) {
			const Ctx =
				window.AudioContext ||
				(window as Window & { webkitAudioContext?: typeof AudioContext })
					.webkitAudioContext;
			if (!Ctx) return null;
			sharedAudioContext = new Ctx();
		}
		if (sharedAudioContext.state === 'suspended') {
			void sharedAudioContext.resume();
		}
		return sharedAudioContext;
	} catch {
		return null;
	}
}

/** Warm up audio after a user gesture so period-end bells are not blocked. */
export function primeTimerAlertAudio() {
	getAudioContext();
}

/** C5 — warm school / factory break-bell pitch. */
const BREAK_BELL_F0 = 523.25;

/** Bronze-bell inharmonic partials with a long ring-out. */
const BREAK_BELL_PARTIALS = [
	{ ratio: 0.5, weight: 0.42, decay: 3.6 },
	{ ratio: 0.92, weight: 0.58, decay: 3.1 },
	{ ratio: 1, weight: 1, decay: 2.9 },
	{ ratio: 1.19, weight: 0.64, decay: 2.3 },
	{ ratio: 1.41, weight: 0.36, decay: 1.6 },
	{ ratio: 1.71, weight: 0.26, decay: 1.15 },
	{ ratio: 2.0, weight: 0.17, decay: 0.82 },
	{ ratio: 2.52, weight: 0.09, decay: 0.48 },
] as const;

function playBreakBellToll(
	ctx: AudioContext,
	startTime: number,
	intensity: number,
) {
	const master = ctx.createGain();
	master.gain.value = intensity;
	master.connect(ctx.destination);

	for (const partial of BREAK_BELL_PARTIALS) {
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = 'sine';

		const baseFreq = BREAK_BELL_F0 * partial.ratio;
		// Slight pitch drop on strike — big bells "thunk" then settle.
		osc.frequency.setValueAtTime(baseFreq * 1.018, startTime);
		osc.frequency.exponentialRampToValueAtTime(baseFreq, startTime + 0.18);

		const peak = 0.1 * partial.weight;
		gain.gain.setValueAtTime(0.0001, startTime);
		gain.gain.exponentialRampToValueAtTime(peak, startTime + 0.01);
		gain.gain.exponentialRampToValueAtTime(0.0001, startTime + partial.decay);

		osc.connect(gain);
		gain.connect(master);
		osc.start(startTime);
		osc.stop(startTime + partial.decay + 0.08);
	}

	// Clapper strike — low bandpass noise for a heavy bronze hit.
	const sampleCount = Math.floor(ctx.sampleRate * 0.05);
	const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
	const samples = buffer.getChannelData(0);
	for (let i = 0; i < sampleCount; i += 1) {
		const envelope = (1 - i / sampleCount) ** 1.6;
		samples[i] = (Math.random() * 2 - 1) * envelope;
	}

	const noise = ctx.createBufferSource();
	noise.buffer = buffer;

	const filter = ctx.createBiquadFilter();
	filter.type = 'bandpass';
	filter.frequency.value = 1800;
	filter.Q.value = 0.65;

	const strikeGain = ctx.createGain();
	strikeGain.gain.setValueAtTime(0.16 * intensity, startTime);
	strikeGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.05);

	noise.connect(filter);
	filter.connect(strikeGain);
	strikeGain.connect(master);
	noise.start(startTime);
	noise.stop(startTime + 0.055);
}

/**
 * Triple break-bell toll when a work or rest period completes —
 * like a school or factory bell calling workers to break.
 */
export function playTimerPeriodBell() {
	const { allowSound, notifyTimer } = readPomodoroPreferences();
	if (!allowSound || !notifyTimer) return;

	const ctx = getAudioContext();
	if (!ctx) return;

	const now = ctx.currentTime;
	const tollGap = 0.92;
	playBreakBellToll(ctx, now, 1);
	playBreakBellToll(ctx, now + tollGap, 0.9);
	playBreakBellToll(ctx, now + tollGap * 2, 0.82);
}
