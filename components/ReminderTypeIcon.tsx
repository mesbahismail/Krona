'use client';

import {
	Briefcase,
	CheckSquare,
	CreditCard,
	FolderKanban,
	Heart,
	Home,
	Palmtree,
	Tag,
	UserRound,
} from 'lucide-react';

export default function ReminderTypeIcon({
	type,
	size = 16,
	className,
}: {
	type: string | null | undefined;
	size?: number;
	className?: string;
}) {
	const normalized = (type || '').trim();
	/* Subscription (and legacy Health → Subscription) always use credit card. */
	if (normalized === 'Subscription' || normalized === 'Health') {
		return <CreditCard size={size} className={className} aria-hidden />;
	}
	if (normalized === 'Work') return <Briefcase size={size} className={className} aria-hidden />;
	if (normalized === 'Personal') return <UserRound size={size} className={className} aria-hidden />;
	if (normalized === 'Vacation') return <Palmtree size={size} className={className} aria-hidden />;
	if (normalized === 'Family') return <Heart size={size} className={className} aria-hidden />;
	if (normalized === 'Finance') return <Home size={size} className={className} aria-hidden />;
	if (normalized === 'project') return <FolderKanban size={size} className={className} aria-hidden />;
	if (normalized === 'task') return <CheckSquare size={size} className={className} aria-hidden />;
	return <Tag size={size} className={className} aria-hidden />;
}
