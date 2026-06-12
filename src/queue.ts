import { Queue } from "bullmq";

import type { WebhookQueuePublisher } from "./app";
import type { RedisConnectionConfig } from "./config";
import type { MetaWebhookJobData } from "./webhookEnvelope";

export interface QueueResources {
  queue: Queue<MetaWebhookJobData, void, string>;
  publisher: WebhookQueuePublisher;
  close: () => Promise<void>;
}

export function createQueueResources(
  redis: RedisConnectionConfig,
  queueName: string,
): QueueResources {
  const queue = new Queue<MetaWebhookJobData, void, string>(queueName, {
    connection: redis,
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
