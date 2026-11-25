import type { NextConfig } from "next";

// Server-only address; never exposed as a NEXT_PUBLIC variable.
const backend = new URL(process.env.DJANGO_API_ORIGIN ?? "http://127.0.0.1:8000");
if (!["http:", "https:"].includes(backend.protocol) || backend.username || backend.password || backend.pathname !== "/" || backend.search || backend.hash) {
  throw new Error("DJANGO_API_ORIGIN must be an HTTP(S) origin without credentials or a path.");
}
const nextConfig: NextConfig = {
  // The development indicator covers the first Campus tab on narrow screens.
  devIndicators: false,
  poweredByHeader: false,
  // Django contracts require trailing slashes; do not redirect POST/PATCH away from them.
  skipTrailingSlashRedirect: true,
  async headers() {
    return [{
      source: "/:path((?!api(?:/|$)).*)",
      headers: [
        // Telegram Web embeds the Mini App. Native Telegram clients do not need a frame exception.
        { key: "Content-Security-Policy", value: "frame-ancestors 'self' https://web.telegram.org; object-src 'none'; base-uri 'self'" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        // Match the Django responses served on the same host.
        ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=3600" }] : []),
      ],
    }];
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backend.origin}/api/:path*/` }];
  },
};
export default nextConfig;
