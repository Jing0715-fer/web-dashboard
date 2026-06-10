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
};

export default nextConfig;
