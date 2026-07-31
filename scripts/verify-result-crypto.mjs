import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/** Must stay identical to src/shared/resultCrypto.ts */
function generateResultKey() {
  return randomBytes(32);
}

function encryptResultTxt(plain, key32) {
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

function decryptResultTxt(envelope, key32) {
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

const key = generateResultKey();
const plain = '1st Prize:\n12345\n\n2nd Prize:\n67890\n';
const envelope = encryptResultTxt(plain, key);
assert.equal(decryptResultTxt(envelope, key), plain);

const badTag = { ...envelope, tag: Buffer.from('bad-tag-bytes!!').toString('base64') };
assert.throws(() => decryptResultTxt(badTag, key), /Unsupported state|unable to authenticate|bad decrypt/i);

const src = fs.readFileSync(new URL('../src/shared/resultCrypto.ts', import.meta.url), 'utf8');
assert.match(src, /export function encryptResultTxt/);
assert.match(src, /export function decryptResultTxt/);
assert.match(src, /export function generateResultKey/);
assert.match(src, /aes-256-gcm/);

console.log('verify-result-crypto: ok');
