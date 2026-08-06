import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";

const PREFIX = "v1";

function getKey(): Buffer {
  const raw = process.env.FIELD_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "FIELD_ENCRYPTION_KEY is not set. Add a 32-byte hex key to .env.local",
    );
  }

  // Accept 64-char hex (32 bytes) or any passphrase hashed to 32 bytes via sha256.
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  return createHash("sha256").update(raw).digest();
}

/** Encrypt sensitive field. Returns opaque ciphertext string. */
export function encryptField(plaintext: string): string {
  const trimmed = plaintext.trim();
  if (!trimmed) return "";

  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(trimmed, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    PREFIX,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

/** Decrypt field. Returns empty string if ciphertext is empty. */
export function decryptField(ciphertext: string | null | undefined): string {
  if (!ciphertext) return "";

  const parts = ciphertext.split(":");
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    throw new Error("Invalid ciphertext format");
  }

  const [, ivB64, tagB64, dataB64] = parts;
  const key = getKey();
  const iv = Buffer.from(ivB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  const data = Buffer.from(dataB64, "base64url");

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}

/** Mask account numbers for display: ****1234 */
export function maskSecret(value: string, visible = 4): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.length <= visible) return "*".repeat(trimmed.length);
  return `${"*".repeat(Math.max(4, trimmed.length - visible))}${trimmed.slice(-visible)}`;
}
