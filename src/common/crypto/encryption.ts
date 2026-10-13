import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

function getAesKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY ?? 'dev-encryption-key-change-me';
  // Ensure 32 bytes key for aes-256
  return createHash('sha256').update(secret).digest();
}

export function encryptToBase64(plainText: string): string {
  const iv = randomBytes(12); // recommended for GCM
  const key = getAesKey();

  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  // payload: iv(12) + tag(16) + ciphertext
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptFromBase64(cipherTextBase64: string): string {
  const payload = Buffer.from(cipherTextBase64, 'base64');
  if (payload.length < 12 + 16) {
    throw new Error('invalid cipher payload');
  }
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const ciphertext = payload.subarray(28);

  const key = getAesKey();
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

