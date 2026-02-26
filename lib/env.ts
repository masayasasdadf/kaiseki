import { z } from "zod";

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1),

  // NextAuth
  NEXTAUTH_URL: z.string().optional(),
  NEXTAUTH_SECRET: z.string().min(1),

  // Optional Google OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // App
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  NEXT_PUBLIC_APP_URL: z.string().optional(),
});

// 実行時に検証（ビルド時は通過させる）
export function getEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("❌ Invalid environment variables:", result.error.flatten());
  }
  return process.env as z.infer<typeof envSchema>;
}

export const env = getEnv();
