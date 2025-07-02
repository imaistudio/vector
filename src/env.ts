import { z } from "zod";
import { config } from "dotenv";
import { existsSync } from "fs";
import { resolve } from "path";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string(),
  APP_URL: z.string().url(),
  BETTER_AUTH_URL: z.string().url().optional(),
  // SMTP credentials (optional)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  // AWS S3 credentials (required for file uploads)
  AWS_ACCESS_KEY_ID: z.string(),
  AWS_SECRET_ACCESS_KEY: z.string(),
  AWS_REGION: z.string(),
  AWS_S3_BUCKET: z.string(),
  // Optional override for non-AWS S3-compatible providers (e.g., MinIO, R2)
  S3_ENDPOINT: z.string().url().optional(),
  S3_FORCE_PATH_STYLE: z.enum(["true", "false"]).optional().default("false"),
  // Public base URL for accessing objects if not standard `${bucket}.s3.amazonaws.com` pattern (e.g., R2 custom domain)
  S3_PUBLIC_BASE_URL: z.string().url().optional(),
});

// Load environment variables from .env files **before** validation.
// Precedence (first wins) mirrors Next.js:
// 1. `.env.<NODE_ENV>.local`
// 2. `.env.local`
// 3. `.env.<NODE_ENV>`
// 4. `.env`
const cwd = process.cwd();
const nodeEnv = process.env.NODE_ENV ?? "development";
const envFiles = [
  `.env.${nodeEnv}.local`,
  ".env.local",
  `.env.${nodeEnv}`,
  ".env",
];

for (const file of envFiles) {
  const path = resolve(cwd, file);
  if (existsSync(path)) {
    // `override: false` ensures first-loaded file wins (higher precedence files appear earlier).
    config({ path, override: false });
  }
}

// Parse and ensure all required env vars are present
const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error("\n================ ENV VALIDATION ERROR ================");
  console.error("❌ Invalid environment variables:");
  console.error(_env.error);
  console.error("Field errors:", _env.error.flatten().fieldErrors);
  console.error("Current process.env values:");
  for (const k of Object.keys(envSchema.shape)) {
    // Only print relevant env vars
    console.error(`  ${k} =`, process.env[k]);
  }
  console.error("======================================================\n");
  throw new Error("Invalid environment variables. See logs above.");
}

export const env = {
  ..._env.data,
  BETTER_AUTH_URL: _env.data.BETTER_AUTH_URL ?? _env.data.APP_URL,
  AWS_ACCESS_KEY_ID: _env.data.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: _env.data.AWS_SECRET_ACCESS_KEY,
  AWS_REGION: _env.data.AWS_REGION,
  AWS_S3_BUCKET: _env.data.AWS_S3_BUCKET,
  S3_ENDPOINT: _env.data.S3_ENDPOINT,
  S3_FORCE_PATH_STYLE: _env.data.S3_FORCE_PATH_STYLE,
  S3_PUBLIC_BASE_URL: _env.data.S3_PUBLIC_BASE_URL,
};
