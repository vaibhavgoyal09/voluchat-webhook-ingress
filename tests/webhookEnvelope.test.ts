import assert from "node:assert/strict";
import test from "node:test";

import { buildWebhookEnvelope } from "../src/webhookEnvelope";

test("buildWebhookEnvelope preserves the exact raw body as base64 with sha256", () => {
  const rawBody = Buffer.from('{"object":"page","entry":[{"id":"page-1"}]}');

  const result = buildWebhookEnvelope({
    rawBody,
    channelParam: "whatsapp",
    matchedSecret: "default",
    method: "POST",
    path: "/whatsapp/webhook",
    headers: { "x-hub-signature-256": "sha256=redacted" },
    ip: "127.0.0.1",
    receivedAt: "2026-06-12T12:00:00.000Z",
  });

  assert.equal(result.jobData.provider, "meta");
  assert.equal(result.jobData.rawBody.encoding, "base64");
  assert.equal(result.jobData.rawBody.data, rawBody.toString("base64"));
  assert.equal(
    result.jobData.rawBody.sha256,
    "cf4757fb1d998bf973749a593b19bf7ecac5a415369525483e3dd6219ed26a52",
  );
  assert.deepEqual(result.jobData.meta.entryIds, ["page-1"]);
});

test("buildWebhookEnvelope records best-effort metadata without requiring JSON", () => {
  const rawBody = Buffer.from("not-json");

  const result = buildWebhookEnvelope({
    rawBody,
    channelParam: "instagram",
    matchedSecret: "instagram",
    method: "POST",
    path: "/instagram/webhook",
    headers: {},
    receivedAt: "2026-06-12T12:00:00.000Z",
  });

  assert.deepEqual(result.jobData.meta, { matchedSecret: "instagram" });
  assert.match(
    result.jobId,
    /^meta:webhook:instagram:unknown:2026-06-12t12-00-00-000z:[a-f0-9]{16}$/,
  );
});

test("buildWebhookEnvelope sanitizes descriptive job id fields", () => {
  const result = buildWebhookEnvelope({
    rawBody: Buffer.from('{"object":"whatsapp_business_account"}'),
    channelParam: "../bad/channel",
    matchedSecret: "default",
    method: "POST",
    path: "/../bad/channel/webhook",
    headers: {},
    receivedAt: "2026-06-12T12:00:00.000Z",
  });

  assert.match(
    result.jobId,
    /^meta:webhook:bad-channel:whatsapp-business-account:2026-06-12t12-00-00-000z:[a-f0-9]{16}$/,
  );
});
