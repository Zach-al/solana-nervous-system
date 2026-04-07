/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow requests to the local SNS daemon
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
    ];
  },
};

export default nextConfig;
