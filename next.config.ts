import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // SSEのためにストリーミングレスポンスを有効化
  experimental: {
    serverActions: {
      allowedOrigins: ["*"],
    },
  },

  // セキュリティヘッダー
  async headers() {
    return [
      {
        source: "/sdk.js",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, stale-while-revalidate=86400",
          },
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
        ],
      },
      {
        source: "/api/ingest",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "POST, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
