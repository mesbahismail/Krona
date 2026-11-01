import type { NextConfig } from 'next';

const securityHeaders = [
	{
		key: 'X-DNS-Prefetch-Control',
		value: 'on',
	},
	{
		key: 'Strict-Transport-Security',
		value: 'max-age=63072000; includeSubDomains; preload',
	},
	{
		// Only this site and the Mesbah Lab live preview may show it in a frame.
		key: 'Content-Security-Policy',
		value: "frame-ancestors 'self' https://mesbahlab.net",
	},
	{
		key: 'X-Content-Type-Options',
		value: 'nosniff',
	},
	{
		key: 'Referrer-Policy',
		value: 'strict-origin-when-cross-origin',
	},
	{
		key: 'Permissions-Policy',
		value:
			'camera=(), microphone=(self), autoplay=(self), geolocation=(), payment=()',
	},
	{
		key: 'X-Permitted-Cross-Domain-Policies',
		value: 'none',
	},
];

const nextConfig: NextConfig = {
	images: {
		qualities: [75, 88],
	},
	async headers() {
		return [
			{
				source: '/:path*',
				headers: securityHeaders,
			},
		];
	},
};

export default nextConfig;
