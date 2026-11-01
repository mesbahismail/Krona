'use client';

import * as React from 'react';
import { Star } from 'lucide-react';

/** Lucide `star` path — gradient must live in the same `<svg>` for reliable fills. */
const STAR_PATH =
	'M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z';

export default function KronaPriorityStar({
	active,
	size = 16,
}: {
	active: boolean;
	size?: number;
}) {
	const gradientId = React.useId().replace(/:/g, '');

	if (!active) {
		return (
			<Star
				size={size}
				fill="none"
				stroke="currentColor"
				strokeWidth={2}
			/>
		);
	}

	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden
		>
			<defs>
				<linearGradient
					id={gradientId}
					x1="0%"
					y1="50%"
					x2="100%"
					y2="50%"
					gradientUnits="objectBoundingBox"
				>
					<stop offset="0%" stopColor="#C8960C" />
					<stop offset="45%" stopColor="#F5C842" />
					<stop offset="100%" stopColor="#FFE082" />
				</linearGradient>
			</defs>
			<path
				d={STAR_PATH}
				fill={`url(#${gradientId})`}
				stroke={`url(#${gradientId})`}
				strokeWidth={1.25}
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}
