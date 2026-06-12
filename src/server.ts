import { createApp } from "./app";
import { loadConfig } from "./config";
import { createQueueResources } from "./queue";

const config = loadConfig();
const queueResources = createQueueResources(
  config.redis,
  config.webhookQueueName,
);
const app = createApp({
  config: {
    metaVerifyToken: config.metaVerifyToken,
    metaSecrets: config.metaSecrets,
  },
  queuePublisher: queueResources.publisher,
});

const server = app.listen(config.port, () => {
  console.log(`Webhook ingress listening on port ${config.port}`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`Received ${signal}, shutting down`);
  server.close(async (error) => {
    if (error) {
      console.error("HTTP server shutdown failed", error);
      process.exitCode = 1;
    }

    await queueResources.close();
    process.exit();
  });
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
