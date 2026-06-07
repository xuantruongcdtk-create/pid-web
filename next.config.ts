import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Allow Supabase Storage avatars + quiz-source thumbnails via next/image.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.supabase.in" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" }, // Google OAuth avatars
    ],
  },
  // Pin Turbopack's workspace root to this project so it stops looking for a
  // parent lockfile when builds run from outside the folder.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
