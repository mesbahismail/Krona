'use client';

import { readPomodoroPreferences } from '@/lib/pomodoroPreferences';
import { readNotificationPreferences } from '@/lib/notificationPreferences';
import { primeTimerAlertAudio } from '@/lib/timerAlertSound';

export type NotificationSoundKind =
	| 'reminder'
	| 'deadline'
	| 'routine'
	| 'taskComplete';

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

export function primeNotificationAudio() {
	primeTimerAlertAudio();
	getAudioContext();
}

function isKindEnabled(kind: NotificationSoundKind): boolean {
	const { allowSound } = readPomodoroPreferences();
	if (!allowSound) return false;

	const prefs = readNotificationPreferences();
	if (!prefs.allowAll) return false;

	if (kind === 'reminder') return prefs.notifyReminders;
	if (kind === 'deadline') return prefs.notifyDeadlines;
	if (kind === 'routine') return prefs.notifyRoutine;
	return prefs.notifyTaskComplete;
}

/** Quick modern notification chime. */
function playChime(): void {
	const ctx = getAudioContext();
	if (!ctx) return;

	const now = ctx.currentTime;
	const master = ctx.createGain();
	master.gain.value = 0.85;
	master.connect(ctx.destination);

	const tones = [
		{ freq: 1046.5, start: 0, peak: 0.22, dur: 0.18 },
		{ freq: 1318.5, start: 0.07, peak: 0.18, dur: 0.22 },
	] as const;

	for (const tone of tones) {
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = 'sine';
		const t0 = now + tone.start;
		osc.frequency.setValueAtTime(tone.freq, t0);
		gain.gain.setValueAtTime(0.0001, t0);
		gain.gain.exponentialRampToValueAtTime(tone.peak, t0 + 0.012);
		gain.gain.exponentialRampToValueAtTime(0.0001, t0 + tone.dur);
		osc.connect(gain);
		gain.connect(master);
		osc.start(t0);
		osc.stop(t0 + tone.dur + 0.02);
	}

	const sampleCount = Math.floor(ctx.sampleRate * 0.02);
	const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
	const samples = buffer.getChannelData(0);
	for (let i = 0; i < sampleCount; i += 1) {
		samples[i] = (Math.random() * 2 - 1) * (1 - i / sampleCount) ** 2;
	}
	const noise = ctx.createBufferSource();
	noise.buffer = buffer;
	const filter = ctx.createBiquadFilter();
	filter.type = 'highpass';
	filter.frequency.value = 2400;
	const strike = ctx.createGain();
	strike.gain.setValueAtTime(0.08, now);
	strike.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
	noise.connect(filter);
	filter.connect(strike);
	strike.connect(master);
	noise.start(now);
	noise.stop(now + 0.025);
}

export function playNotificationSound(
	kind: NotificationSoundKind = 'reminder',
): void {
	if (!isKindEnabled(kind)) return;
	playChime();
}

/** Settings preview — only requires Allow Sound + Allow Notifications. */
export function playNotificationSoundPreview(): void {
	const { allowSound } = readPomodoroPreferences();
	if (!allowSound) return;
	if (!readNotificationPreferences().allowAll) return;
	primeNotificationAudio();
	playChime();
}
