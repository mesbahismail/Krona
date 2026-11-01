import dayjs from 'dayjs';
import { localData } from '@/lib/localData';
import { notifyRemindersUpdated } from '@/lib/kronaDataEvents';

export type ReminderOrderItem = {
	id?: string;
	date: string;
	taskId?: string | null;
	projectId?: string | null;
};

const DAY_START_MINUTES = 9 * 60;
const SLOT_MINUTES = 30;

/** Assign a time slot for a newly created standalone reminder without shifting existing ones. */
export function assignReminderTimeForNewItem<T extends ReminderOrderItem>(
	existing: T[],
	newItem: T,
): T {
	if (newItem.taskId || newItem.projectId) {
		return newItem;
	}
	const dayKey = dayjs(newItem.date).format('YYYY-MM-DD');
	let slotIndex = 0;
	for (const rem of existing) {
		if (rem.taskId || rem.projectId) continue;
		if (dayjs(rem.date).format('YYYY-MM-DD') === dayKey) slotIndex++;
	}
	const minutes = DAY_START_MINUTES + slotIndex * SLOT_MINUTES;
	return {
		...newItem,
		date: dayjs(newItem.date).startOf('day').add(minutes, 'minute').toISOString(),
	};
}

/** Assign sequential times per calendar day based on list order (9:00, 9:30, …). */
export function recalculateReminderTimes<T extends ReminderOrderItem>(
	ordered: T[],
): T[] {
	const daySlots = new Map<string, number>();

	return ordered.map((rem) => {
		if (rem.taskId || rem.projectId) {
			return rem;
		}
		const dayKey = dayjs(rem.date).format('YYYY-MM-DD');
		const slotIndex = daySlots.get(dayKey) ?? 0;
		daySlots.set(dayKey, slotIndex + 1);
		const minutes = DAY_START_MINUTES + slotIndex * SLOT_MINUTES;
		const nextDate = dayjs(rem.date).startOf('day').add(minutes, 'minute').toISOString();
		return { ...rem, date: nextDate };
	});
}

export function sortRemindersForDisplay<
	T extends ReminderOrderItem & { sortOrder?: number | null },
>(list: T[]): T[] {
	return [...list].sort((a, b) => {
		const aOrder = a.sortOrder;
		const bOrder = b.sortOrder;
		if (aOrder != null && bOrder != null && aOrder !== bOrder) {
			return aOrder - bOrder;
		}
		if (aOrder != null && bOrder == null) return -1;
		if (aOrder == null && bOrder != null) return 1;
		return new Date(a.date).getTime() - new Date(b.date).getTime();
	});
}

export function reorderReminderList<T extends ReminderOrderItem>(
	list: T[],
	fromIndex: number,
	toIndex: number,
): T[] {
	if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return list;
	const next = [...list];
	const [moved] = next.splice(fromIndex, 1);
	next.splice(toIndex, 0, moved);
	return recalculateReminderTimes(next);
}

export function formatReminderDateTime(iso: string): string {
	const d = dayjs(iso);
	if (!d.isValid()) return iso;
	const hasTime = d.hour() !== 0 || d.minute() !== 0;
	return hasTime ? d.format('MMM D, YYYY · h:mm A') : d.format('MMM D, YYYY');
}

export async function persistReminderOrder(
	userId: string,
	ordered: ReminderOrderItem[],
	options?: { notify?: boolean },
): Promise<void> {
	await Promise.all(
		ordered.map((rem, index) => {
			if (!rem.id || rem.id.startsWith('pending-')) return Promise.resolve();
			const payload: {
				sort_order: number;
				due_date?: string;
			} = { sort_order: index };
			if (!rem.taskId && !rem.projectId) {
				payload.due_date = rem.date;
			}
			return localData
				.from('reminders')
				.update(payload)
				.eq('id', rem.id)
				.eq('user_id', userId);
		}),
	);
	if (options?.notify !== false) {
		notifyRemindersUpdated();
	}
}
