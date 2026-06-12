import { createHmac } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";

import {
  findMatchingMetaSecret,
  sha256Hex,
  verifyMetaSignature,
} from "../src/metaSignature";

function sign(secret: string, body: Buffer): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

test("verifyMetaSignature accepts a valid x-hub-signature-256 header", () => {
  const body = Buffer.from('{"object":"page"}');
  const secret = "default-secret";

  assert.equal(verifyMetaSignature(body, sign(secret, body), secret), true);
});

test("findMatchingMetaSecret returns the configured secret that matches the signature", () => {
  const body = Buffer.from('{"object":"instagram"}');
  const secrets = [
    { name: "default", value: "default-secret" },
    { name: "instagram", value: "instagram-secret" },
  ] as const;

  const match = findMatchingMetaSecret(body, sign("instagram-secret", body), secrets);

  assert.deepEqual(match, { name: "instagram" });
});

test("verifyMetaSignature rejects invalid signatures and malformed headers", () => {
  const body = Buffer.from('{"object":"page"}');
  const secret = "default-secret";

  assert.equal(verifyMetaSignature(body, sign("wrong-secret", body), secret), false);
  assert.equal(verifyMetaSignature(body, "not-a-meta-signature", secret), false);
  assert.equal(verifyMetaSignature(body, undefined, secret), false);
});

test("sha256Hex returns the raw body sha256 digest", () => {
  assert.equal(
    sha256Hex(Buffer.from("exact-body")),
    "38fba87074b486c53af8779972376588019bf2d0217f47a1b4965942235dccac",
  );
});
