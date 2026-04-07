import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // ── Anti-reverse-engineering ────────────────────────────────
  // No source maps exposed in production builds
  productionBrowserSourceMaps: false,

  compiler: {
    // Strip all console.log/warn/error from production bundle
    removeConsole: process.env.NODE_ENV === 'production',
  },

  async headers() {
    return [
      {
        // Security headers (Vercel edge) — middleware also sets these,
        // this is a belt-and-suspenders defence in case middleware is bypassed.
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'X-Robots-Tag', value: 'noindex' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          // Allow cross-origin requests from any SNS daemon
          { key: 'Access-Control-Allow-Origin', value: '*' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline' fonts.googleapis.com",
              "font-src 'self' fonts.gstatic.com",
              "img-src 'self' data: blob:",
              "connect-src 'self' https://*.railway.app https://*.solana.com wss://*.railway.app https://solnet-production.up.railway.app",
              "worker-src blob:",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

export default nextConfig
