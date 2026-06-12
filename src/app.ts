import express, { type Request, type Response } from "express";

import type { MetaSecret } from "./metaSignature";
import { findMatchingMetaSecret } from "./metaSignature";
import {
  buildWebhookEnvelope,
  type MetaWebhookJobData,
} from "./webhookEnvelope";

export interface WebhookQueuePublisher {
  publish(
    name: string,
    data: MetaWebhookJobData,
    options: { jobId: string },
  ): Promise<void>;
}

export interface CreateAppConfig {
  metaVerifyToken: string;
  metaSecrets: MetaSecret[];
}

export interface CreateAppOptions {
  config: CreateAppConfig;
  queuePublisher: WebhookQueuePublisher;
}

export interface HandlerResult {
  status: number;
  body: string;
}

export interface HandleWebhookDeliveryInput {
  rawBody: Buffer;
  signature: string | string[] | undefined;
  channelParam: string;
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  config: CreateAppConfig;
  queuePublisher: WebhookQueuePublisher;
}

const webhookJobName = "meta-webhook.received";

export function createApp(options: CreateAppOptions): express.Express {
  const app = express();

  app.get("/healthz", (_req: Request, res: Response) => {
    res.status(200).json({ ok: true });
  });

  app.get("/:channel/webhook", (req: Request, res: Response) => {
    const result = handleWebhookVerification({
      mode: stringQuery(req.query["hub.mode"]),
      challenge: stringQuery(req.query["hub.challenge"]),
      verifyToken: stringQuery(req.query["hub.verify_token"]),
      expectedVerifyToken: options.config.metaVerifyToken,
    });

    res.status(result.status).send(result.body);
  });

  app.post(
    "/:channel/webhook",
    express.raw({ type: "*/*", limit: "2mb" }),
    async (req: Request, res: Response) => {
      const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      const result = await handleWebhookDelivery({
        rawBody,
        signature: req.header("x-hub-signature-256"),
        channelParam: stringParam(req.params.channel) ?? "unknown",
        method: req.method,
        path: req.originalUrl,
        headers: req.headers,
        ip: req.ip,
        config: options.config,
        queuePublisher: options.queuePublisher,
      });

      res.status(result.status).send(result.body);
    },
  );

  return app;
}

export function handleWebhookVerification(input: {
  mode: string | undefined;
  challenge: string | undefined;
  verifyToken: string | undefined;
  expectedVerifyToken: string;
}): HandlerResult {
  if (
    input.mode === "subscribe" &&
    input.challenge !== undefined &&
    input.verifyToken === input.expectedVerifyToken
  ) {
    return { status: 200, body: input.challenge };
  }

  return { status: 403, body: "Forbidden" };
}

export async function handleWebhookDelivery(
  input: HandleWebhookDeliveryInput,
): Promise<HandlerResult> {
  const matchedSecret = findMatchingMetaSecret(
    input.rawBody,
    input.signature,
    input.config.metaSecrets,
  );

  if (!matchedSecret) {
    return { status: 401, body: "Invalid webhook signature" };
  }

  const envelope = buildWebhookEnvelope({
    rawBody: input.rawBody,
    channelParam: input.channelParam,
    matchedSecret: matchedSecret.name,
    method: input.method,
    path: input.path,
    headers: input.headers,
    ip: input.ip,
  });

  try {
    await input.queuePublisher.publish(webhookJobName, envelope.jobData, {
      jobId: envelope.jobId,
    });
  } catch (error) {
    console.error("[WEBHOOK_ENQUEUE_FAILED]", error);
    return { status: 500, body: "Failed to enqueue webhook" };
  }

  return { status: 200, body: "OK" };
}

function stringQuery(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function stringParam(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}
