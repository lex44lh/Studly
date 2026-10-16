import type { NextConfig } from "next";

// Server-only address; never exposed as a NEXT_PUBLIC variable.
const backend = new URL(process.env.DJANGO_API_ORIGIN ?? "http://127.0.0.1:8000");
if (!["http:", "https:"].includes(backend.protocol) || backend.username || backend.password || backend.pathname !== "/" || backend.search || backend.hash) {
  throw new Error("DJANGO_API_ORIGIN must be an HTTP(S) origin without credentials or a path.");
}
const nextConfig: NextConfig = {
  // Django contracts require trailing slashes; do not redirect POST/PATCH away from them.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backend.origin}/api/:path*/` }];
  },
};
export default nextConfig;
