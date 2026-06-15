import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/recruitment", destination: "/mercato", permanent: true },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "koppafoot.firebasestorage.app",
      },
      // Competition team logos / flags + competition logo/banner are organizer-entered
      // free-text URLs from arbitrary hosts, so next/image would otherwise hard-crash the
      // public pages on an unconfigured hostname. Allow any HTTPS host for these.
      // TRADEOFF: this opens the Next image optimizer to fetch arbitrary https URLs
      // (open-proxy/SSRF surface). Acceptable short-term since logos are organizer-entered
      // (a promoted role), but should be hardened — see follow-up (switch these crests to
      // plain <img>, or require Firebase Storage uploads).
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
