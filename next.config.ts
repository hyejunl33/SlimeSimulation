import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    // some options might need this
  },
  // In Next.js 16 it's at the root config or experimental. The log says root level.
  allowedDevOrigins: [
    "teiqb-210-110-58-28.free.pinggy.net",
    "gzech-210-110-58-28.free.pinggy.net",
    "172.17.6.186",
    "spotty-spiders-cheer.loca.lt",
    "hot-feet-call.loca.lt",
    "flat-cloths-drop.loca.lt",
    "cyan-bees-wish.loca.lt",
    "localhost:3000"
  ]
};

export default nextConfig;
