export const PENDING_CHALLENGE_GIFT_KEY = 'pending';
export const CUSTOM_REWARD_GIFT_PREFIX = 'custom:';
export const TROPHY_REWARD_IMAGE = '/rewards/Trophy.png';

export type ChallengeGift = {
	key: string;
	label: string;
	/** Large reward card headline (e.g. "Gaming time!"). */
	rewardTitle: string;
	emoji: string;
	description: string;
	imageSrc: string;
};

function rewardImagePath(filename: string): string {
	return `/rewards/${encodeURIComponent(filename)}`;
}

/** Self-reward options the user can pick when completing a challenge. */
export const CHALLENGE_GIFTS: ChallengeGift[] = [
	{
		key: 'coffee',
		label: 'Coffee break',
		rewardTitle: 'Coffee break!',
		emoji: '☕',
		description: 'Treat yourself to a great coffee.',
		imageSrc: rewardImagePath('Coffee break!.png'),
	},
	{
		key: 'walk',
		label: 'Walk outside',
		rewardTitle: 'Go out for a walk!',
		emoji: '🚶',
		description: 'A refreshing walk outside.',
		imageSrc: rewardImagePath('Go out for a walk!.png'),
	},
	{
		key: 'game',
		label: 'Game time',
		rewardTitle: 'Gaming time!',
		emoji: '🎮',
		description: '30 minutes of guilt-free gaming.',
		imageSrc: rewardImagePath('Gaming time!.png'),
	},
	{
		key: 'snack',
		label: 'Favorite snack',
		rewardTitle: 'Have a snack!',
		emoji: '🍫',
		description: 'Enjoy your go-to snack.',
		imageSrc: rewardImagePath('Have a snack!.png'),
	},
	{
		key: 'nap',
		label: 'Power nap',
		rewardTitle: 'Take a nap!',
		emoji: '😴',
		description: 'A short rest to recharge.',
		imageSrc: rewardImagePath('Take a nap!.png'),
	},
	{
		key: 'music',
		label: 'Music session',
		rewardTitle: 'Music session!',
		emoji: '🎧',
		description: 'Listen to an album you love.',
		imageSrc: rewardImagePath('Music session!.png'),
	},
	{
		key: 'movie',
		label: 'Episode or movie',
		rewardTitle: 'Movie time!',
		emoji: '🎬',
		description: 'One episode or a short film.',
		imageSrc: rewardImagePath('Movie time!.png'),
	},
	{
		key: 'shopping',
		label: 'Small purchase',
		rewardTitle: 'Go shopping!',
		emoji: '🛍️',
		description: 'Buy something small you wanted.',
		imageSrc: rewardImagePath('Go shopping!.png'),
	},
	{
		key: 'social',
		label: 'Get a drink',
		rewardTitle: 'Get a drink!',
		emoji: '🥤',
		description: 'Enjoy your favorite drink.',
		imageSrc: rewardImagePath('Get a drink!.png'),
	},
	{
		key: 'stretch',
		label: 'Yoga time',
		rewardTitle: 'Yoga time!',
		emoji: '🧘',
		description: 'Yoga or stretching session.',
		imageSrc: rewardImagePath('Yoga time!.png'),
	},
];

export function challengeGiftRewardTitle(gift: ChallengeGift): string {
	return gift.rewardTitle || gift.label;
}

export function isCustomRewardGiftKey(key: string): boolean {
	return key.startsWith(CUSTOM_REWARD_GIFT_PREFIX);
}

export function customRewardNameFromKey(key: string): string | null {
	if (!isCustomRewardGiftKey(key)) return null;
	const raw = key.slice(CUSTOM_REWARD_GIFT_PREFIX.length);
	if (!raw) return null;
	try {
		return decodeURIComponent(raw);
	} catch {
		return raw;
	}
}

export function customRewardGiftKey(name: string): string {
	return `${CUSTOM_REWARD_GIFT_PREFIX}${encodeURIComponent(name.trim())}`;
}

export function getChallengeGift(key: string): ChallengeGift | undefined {
	if (!key || key === PENDING_CHALLENGE_GIFT_KEY || isCustomRewardGiftKey(key)) {
		return undefined;
	}
	return CHALLENGE_GIFTS.find((gift) => gift.key === key);
}

export type ResolvedRewardDisplay = {
	title: string;
	imageSrc: string;
	isCustom: boolean;
};

export function resolveRewardDisplay(key: string | null): ResolvedRewardDisplay | null {
	if (!key || key === PENDING_CHALLENGE_GIFT_KEY) return null;

	if (isCustomRewardGiftKey(key)) {
		const name = customRewardNameFromKey(key);
		if (!name) return null;
		return { title: name, imageSrc: TROPHY_REWARD_IMAGE, isCustom: true };
	}

	const gift = getChallengeGift(key);
	if (!gift) return null;
	return {
		title: challengeGiftRewardTitle(gift),
		imageSrc: gift.imageSrc,
		isCustom: false,
	};
}
