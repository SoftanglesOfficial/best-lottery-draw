import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export type ResultEnvelopeV1 = { v: 1; iv: string; tag: string; data: string };

export function generateResultKey(): Buffer {
  return randomBytes(32);
}

export function encryptResultTxt(plain: string, key32: Buffer): ResultEnvelopeV1 {
  if (key32.length !== 32) throw new Error('Result key must be 32 bytes');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key32, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    v: 1,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: enc.toString('base64'),
  };
}

export function decryptResultTxt(envelope: ResultEnvelopeV1, key32: Buffer): string {
  if (envelope.v !== 1) throw new Error('Unsupported result file version');
  if (key32.length !== 32) throw new Error('Result key must be 32 bytes');
  const decipher = createDecipheriv('aes-256-gcm', key32, Buffer.from(envelope.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(envelope.data, 'base64')),
    decipher.final(),
  ]);
  return dec.toString('utf8');
}
