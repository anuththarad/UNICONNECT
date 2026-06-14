// utils/cryptoUtils.js
// ─────────────────────────────────────────────────────────────
//  AES-256-CBC encryption for sensitive fields (phone numbers)
//  HMAC-SHA256 for lookup hashes
//
//  Required .env keys:
//    PHONE_ENCRYPT_KEY   – 64 hex chars  (32 bytes)  for AES-256
//    PHONE_HMAC_SECRET   – 64 hex chars  (32 bytes)  for HMAC
// ─────────────────────────────────────────────────────────────

'use strict';

const crypto = require('crypto');

const ALGO      = 'aes-256-cbc';
const IV_BYTES  = 16;
const KEY_HEX   = process.env.PHONE_ENCRYPT_KEY || '';
const HMAC_HEX  = process.env.PHONE_HMAC_SECRET || '';

function _getKey(hexStr, label) {
    if (!hexStr || hexStr.length !== 64) {
        throw new Error(
            `[cryptoUtils] ${label} must be a 64-char hex string (32 bytes). ` +
            `Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
        );
    }
    return Buffer.from(hexStr, 'hex');
}

/**
 * Encrypt plaintext → { encrypted: string(hex), iv: string(hex) }
 */
function encrypt(plaintext) {
    const key = _getKey(KEY_HEX, 'PHONE_ENCRYPT_KEY');
    const iv  = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv(ALGO, key, iv);
    const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final()
    ]);
    return {
        encrypted: encrypted.toString('hex'),
        iv:        iv.toString('hex')
    };
}

/**
 * Decrypt { encrypted: string(hex), iv: string(hex) } → plaintext
 */
function decrypt({ encrypted, iv }) {
    const key     = _getKey(KEY_HEX, 'PHONE_ENCRYPT_KEY');
    const ivBuf   = Buffer.from(iv, 'hex');
    const encBuf  = Buffer.from(encrypted, 'hex');
    const decipher = crypto.createDecipheriv(ALGO, key, ivBuf);
    const decrypted = Buffer.concat([
        decipher.update(encBuf),
        decipher.final()
    ]);
    return decrypted.toString('utf8');
}

/**
 * HMAC-SHA256 of plaintext (for duplicate/lookup without decryption)
 */
function hmac(plaintext) {
    const key = _getKey(HMAC_HEX, 'PHONE_HMAC_SECRET');
    return crypto.createHmac('sha256', key).update(plaintext, 'utf8').digest('hex');
}

module.exports = { encrypt, decrypt, hmac };