import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone 模式: 产出 .next/standalone/server.js（项目用 project-manager.sh 启动）
  output: "standalone",
  allowedDevOrigins: [
    'preview-chat-ae8a34bd-c8a9-4464-ae34-38a84c9fe2d6.space-z.ai',
  ],
  typescript: {
    ignoreBuildErrors: true,
  },
  // Disable webpack cache to avoid stale build artifacts
  webpack: (config) => {
    config.cache = false;
    return config;
  },
  // Empty turbopack config — silences the "webpack config with no
  // turbopack config" warning in Next 16 dev mode (launchd's `next dev`
  // was crashing on this conflict and entering a restart loop).
  turbopack: {},
};

export default nextConfig;
