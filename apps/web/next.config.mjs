import path from 'node:path';

function resolveApiProxyTarget() {
  const explicitTarget = process.env.API_PROXY_TARGET;
  if (explicitTarget) {
    return explicitTarget.replace(/\/+$/, '');
  }

  const publicApiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (publicApiUrl && /^https?:\/\//.test(publicApiUrl)) {
    return publicApiUrl.replace(/\/+$/, '');
  }

  return 'http://127.0.0.1:3001/api/v1';
}

const apiProxyTarget = resolveApiProxyTarget();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(process.cwd(), '../../'),
  async rewrites() {
    return [
      {
        source: '/backend-api/:path*',
        destination: `${apiProxyTarget}/:path*`
      }
    ];
  }
};

export default nextConfig;
