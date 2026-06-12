import type { MetaSecret } from "./metaSignature";

export interface AppConfig {
  port: number;
  metaVerifyToken: string;
  metaSecrets: MetaSecret[];
  redisUrl: string;
  webhookQueueName: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const metaVerifyToken = requireEnv(env, "META_VERIFY_TOKEN");
  const defaultSecret = requireEnv(env, "META_APP_SECRET");
  const instagramSecret = requireEnv(env, "META_INSTAGRAM_APP_SECRET");

  return {
    port: parsePort(env.PORT),
    metaVerifyToken,
    metaSecrets: [
      { name: "default", value: defaultSecret },
      { name: "instagram", value: instagramSecret },
    ],
    redisUrl: env.REDIS_URL ?? "redis://127.0.0.1:6379",
    webhookQueueName: env.WEBHOOK_QUEUE_NAME ?? "meta-webhooks",
  };
}

function requireEnv(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (!value) {
    throw new Error(`${key} is required`);
  }
  return value;
}

function parsePort(value: string | undefined): number {
  if (!value) {
    return 3000;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  return port;
}
