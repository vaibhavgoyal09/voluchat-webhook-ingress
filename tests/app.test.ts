import { createHmac } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";

import {
  handleWebhookDelivery,
  handleWebhookVerification,
  type CreateAppConfig,
  type WebhookQueuePublisher,
} from "../src/app";
import type { MetaWebhookJobData } from "../src/webhookEnvelope";

interface PublishedJob {
  name: string;
  data: MetaWebhookJobData;
  jobId: string;
}

const config: CreateAppConfig = {
  metaVerifyToken: "verify-token",
  metaSecrets: [
    { name: "default", value: "default-secret" },
    { name: "instagram", value: "instagram-secret" },
  ],
};

function sign(secret: string, body: Buffer): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

function publisherThatRecords(published: PublishedJob[]): WebhookQueuePublisher {
  return {
    async publish(name, data, options) {
      published.push({ name, data, jobId: options.jobId });
    },
  };
}

test("GET webhook verification returns hub.challenge for a valid verify token", () => {
  const result = handleWebhookVerification({
    mode: "subscribe",
    challenge: "challenge-123",
    verifyToken: "verify-token",
    expectedVerifyToken: config.metaVerifyToken,
  });

  assert.deepEqual(result, { status: 200, body: "challenge-123" });
});

test("GET webhook verification rejects invalid verify tokens", () => {
  const result = handleWebhookVerification({
    mode: "subscribe",
    challenge: "challenge-123",
    verifyToken: "wrong",
    expectedVerifyToken: config.metaVerifyToken,
  });

  assert.deepEqual(result, { status: 403, body: "Forbidden" });
});

test("POST webhook delivery rejects invalid Meta signatures", async () => {
  const published: PublishedJob[] = [];
  const body = Buffer.from('{"object":"page"}');

  const result = await handleWebhookDelivery({
    rawBody: body,
    signature: sign("wrong-secret", body),
    channelParam: "whatsapp",
    method: "POST",
    path: "/whatsapp/webhook",
    headers: {},
    config,
    queuePublisher: publisherThatRecords(published),
  });

  assert.deepEqual(result, { status: 401, body: "Invalid webhook signature" });
  assert.equal(published.length, 0);
});

test("POST webhook delivery enqueues a valid signed payload into one queue job", async () => {
  const published: PublishedJob[] = [];
  const body = Buffer.from('{"object":"page","entry":[{"id":"page-1"}]}');

  const result = await handleWebhookDelivery({
    rawBody: body,
    signature: sign("default-secret", body),
    channelParam: "messenger",
    method: "POST",
    path: "/messenger/webhook",
    headers: { "x-hub-signature-256": "sha256=redacted" },
    ip: "127.0.0.1",
    config,
    queuePublisher: publisherThatRecords(published),
  });

  assert.deepEqual(result, { status: 200, body: "OK" });
  assert.equal(published.length, 1);
  assert.equal(published[0]?.name, "meta-webhook.received");
  assert.equal(published[0]?.data.rawBody.data, body.toString("base64"));
  assert.equal(published[0]?.data.request.channelParam, "messenger");
  assert.equal(published[0]?.data.meta.matchedSecret, "default");
  assert.deepEqual(published[0]?.data.meta.entryIds, ["page-1"]);
});

test("POST webhook delivery accepts Instagram-signed payload even on another route", async () => {
  const published: PublishedJob[] = [];
  const body = Buffer.from('{"object":"instagram","entry":[{"id":"ig-1"}]}');

  const result = await handleWebhookDelivery({
    rawBody: body,
    signature: sign("instagram-secret", body),
    channelParam: "whatsapp",
    method: "POST",
    path: "/whatsapp/webhook",
    headers: {},
    config,
    queuePublisher: publisherThatRecords(published),
  });

  assert.deepEqual(result, { status: 200, body: "OK" });
  assert.equal(published.length, 1);
  assert.equal(published[0]?.data.request.channelParam, "whatsapp");
  assert.equal(published[0]?.data.meta.object, "instagram");
  assert.equal(published[0]?.data.meta.matchedSecret, "instagram");
});

test("POST webhook delivery returns 500 when enqueue fails so Meta can retry", async () => {
  const body = Buffer.from('{"object":"page"}');
  const failingPublisher: WebhookQueuePublisher = {
    async publish() {
      throw new Error("redis unavailable");
    },
  };

  const result = await handleWebhookDelivery({
    rawBody: body,
    signature: sign("default-secret", body),
    channelParam: "facebook",
    method: "POST",
    path: "/facebook/webhook",
    headers: {},
    config,
    queuePublisher: failingPublisher,
  });

  assert.deepEqual(result, { status: 500, body: "Failed to enqueue webhook" });
});
