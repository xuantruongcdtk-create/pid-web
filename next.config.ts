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
  // parent lockfile when builds run from outside the folder. We use
  // `process.cwd()` instead of `__dirname` because next.config.ts is compiled
  // as ESM on Vercel, where __dirname is undefined.
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
