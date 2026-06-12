import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type MetaSecretName = "default" | "instagram";

export interface MetaSecret {
  name: MetaSecretName;
  value: string;
}

export interface MetaSecretMatch {
  name: MetaSecretName;
}

const signaturePrefix = "sha256=";

export function sha256Hex(body: Buffer): string {
  return createHash("sha256").update(body).digest("hex");
}

export function verifyMetaSignature(
  body: Buffer,
  signatureHeader: string | string[] | undefined,
  appSecret: string,
): boolean {
  if (!appSecret || Array.isArray(signatureHeader) || !signatureHeader) {
    return false;
  }

  if (!signatureHeader.startsWith(signaturePrefix)) {
    return false;
  }

  const providedHex = signatureHeader.slice(signaturePrefix.length);
  if (!/^[a-fA-F0-9]{64}$/.test(providedHex)) {
    return false;
  }

  const expectedHex = createHmac("sha256", appSecret).update(body).digest("hex");
  const provided = Buffer.from(providedHex, "hex");
  const expected = Buffer.from(expectedHex, "hex");

  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export function findMatchingMetaSecret(
  body: Buffer,
  signatureHeader: string | string[] | undefined,
  secrets: readonly MetaSecret[],
): MetaSecretMatch | undefined {
  const match = secrets.find((secret) =>
    verifyMetaSignature(body, signatureHeader, secret.value),
  );

  return match ? { name: match.name } : undefined;
}
