import { Queue } from "bullmq";

import type { WebhookQueuePublisher } from "./app";
import type { MetaWebhookJobData } from "./webhookEnvelope";

export interface QueueResources {
  queue: Queue<MetaWebhookJobData, void, string>;
  publisher: WebhookQueuePublisher;
  close: () => Promise<void>;
}

export function createQueueResources(
  redisUrl: string,
  queueName: string,
): QueueResources {
  const queue = new Queue<MetaWebhookJobData, void, string>(queueName, {
    connection: redisUrlToConnectionOptions(redisUrl),
  });

  return {
    queue,
    publisher: {
      async publish(name, data, options) {
        await queue.add(name, data, {
          jobId: options.jobId,
          attempts: 5,
          backoff: {
            type: "exponential",
            delay: 1000,
          },
          removeOnComplete: {
            age: 86_400,
            count: 10_000,
          },
          removeOnFail: {
            age: 604_800,
          },
        });
      },
    },
    async close() {
      await queue.close();
    },
  };
}

function redisUrlToConnectionOptions(redisUrl: string) {
  const url = new URL(redisUrl);
  const db = url.pathname.length > 1 ? Number(url.pathname.slice(1)) : undefined;

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    username: decodeURIComponent(url.username) || undefined,
    password: decodeURIComponent(url.password) || undefined,
    db: Number.isInteger(db) ? db : undefined,
    tls: url.protocol === "rediss:" ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}
