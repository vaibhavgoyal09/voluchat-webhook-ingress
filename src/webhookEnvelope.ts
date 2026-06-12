import type { MetaSecretName } from "./metaSignature";
import { sha256Hex } from "./metaSignature";

export interface BuildWebhookEnvelopeInput {
  rawBody: Buffer;
  channelParam: string;
  matchedSecret: MetaSecretName;
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  receivedAt?: string;
}

export interface MetaWebhookJobData {
  provider: "meta";
  receivedAt: string;
  request: {
    method: string;
    path: string;
    channelParam: string;
    headers: Record<string, string | string[] | undefined>;
    ip?: string;
  };
  rawBody: {
    encoding: "base64";
    data: string;
    sha256: string;
  };
  meta: {
    matchedSecret: MetaSecretName;
    object?: string;
    entryIds?: string[];
  };
}

export interface BuiltWebhookEnvelope {
  jobId: string;
  jobData: MetaWebhookJobData;
}

export function buildWebhookEnvelope(
  input: BuildWebhookEnvelopeInput,
): BuiltWebhookEnvelope {
  const receivedAt = input.receivedAt ?? new Date().toISOString();
  const bodySha256 = sha256Hex(input.rawBody);
  const parsed = parseJsonObject(input.rawBody);
  const object = typeof parsed?.object === "string" ? parsed.object : undefined;
  const entryIds = extractEntryIds(parsed);

  const meta: MetaWebhookJobData["meta"] = {
    matchedSecret: input.matchedSecret,
  };
  if (object) {
    meta.object = object;
  }
  if (entryIds.length > 0) {
    meta.entryIds = entryIds;
  }

  const jobData: MetaWebhookJobData = {
    provider: "meta",
    receivedAt,
    request: {
      method: input.method,
      path: input.path,
      channelParam: input.channelParam,
      headers: input.headers,
      ...(input.ip ? { ip: input.ip } : {}),
    },
    rawBody: {
      encoding: "base64",
      data: input.rawBody.toString("base64"),
      sha256: bodySha256,
    },
    meta,
  };

  return {
    jobData,
    jobId: [
      "meta",
      "webhook",
      sanitizeJobIdPart(input.channelParam),
      sanitizeJobIdPart(object ?? "unknown"),
      sanitizeJobIdPart(receivedAt),
      bodySha256.slice(0, 16),
    ].join("-"),
  };
}

function parseJsonObject(rawBody: Buffer): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(rawBody.toString("utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function extractEntryIds(parsed: Record<string, unknown> | undefined): string[] {
  if (!parsed || !Array.isArray(parsed.entry)) {
    return [];
  }

  return parsed.entry
    .map((entry) =>
      entry && typeof entry === "object"
        ? (entry as Record<string, unknown>).id
        : undefined,
    )
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

function sanitizeJobIdPart(value: string): string {
  const sanitized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return sanitized || "unknown";
}
