import assert from "node:assert/strict";
import test from "node:test";

import { loadConfig } from "../src/config";

const requiredEnv = {
  META_VERIFY_TOKEN: "verify-token",
  META_APP_SECRET: "default-secret",
  META_INSTAGRAM_APP_SECRET: "instagram-secret",
};

test("loadConfig builds Redis connection settings from separate Redis env vars", () => {
  const config = loadConfig({
    ...requiredEnv,
    REDIS_HOST: "redis.example.com",
    REDIS_PORT: "6380",
    REDIS_USERNAME: "default",
    REDIS_PASSWORD: "secret",
    REDIS_SSL: "true",
  });

  assert.deepEqual(config.redis, {
    host: "redis.example.com",
    port: 6380,
    username: "default",
    password: "secret",
    tls: {},
    maxRetriesPerRequest: null,
  });
});

test("loadConfig supports lowercase Redis env var aliases", () => {
  const config = loadConfig({
    ...requiredEnv,
    redis_host: "localhost",
    redis_port: "6379",
    redis_ssl: "false",
  });

  assert.deepEqual(config.redis, {
    host: "localhost",
    port: 6379,
    username: undefined,
    password: undefined,
    tls: undefined,
    maxRetriesPerRequest: null,
  });
});
