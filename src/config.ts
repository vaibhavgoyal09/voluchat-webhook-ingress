import type { MetaSecret } from "./metaSignature";

export interface AppConfig {
  port: number;
  metaVerifyToken: string;
  metaSecrets: MetaSecret[];
  redis: RedisConnectionConfig;
  webhookQueueName: string;
}

export interface RedisConnectionConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  tls?: Record<string, never>;
  maxRetriesPerRequest: null;
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
    redis: loadRedisConfig(env),
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

function loadRedisConfig(env: NodeJS.ProcessEnv): RedisConnectionConfig {
  const host = envValue(env, "REDIS_HOST", "redis_host") ?? "127.0.0.1";
  const port = parseRedisPort(envValue(env, "REDIS_PORT", "redis_port"));
  const username = envValue(env, "REDIS_USERNAME", "redis_username");
  const password = envValue(env, "REDIS_PASSWORD", "redis_password");
  const ssl = parseBooleanEnv(envValue(env, "REDIS_SSL", "redis_ssl"));

  return {
    host,
    port,
    username,
    password,
    tls: ssl ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}

function envValue(
  env: NodeJS.ProcessEnv,
  upperKey: string,
  lowerKey: string,
): string | undefined {
  return env[upperKey] ?? env[lowerKey];
}

function parseRedisPort(value: string | undefined): number {
  if (!value) {
    return 6379;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error("REDIS_PORT must be an integer between 1 and 65535");
  }

  return port;
}

function parseBooleanEnv(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}
