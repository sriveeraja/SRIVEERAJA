import { ShopLedgerData, ShopProfile } from '../types/ledger';

const PIN_HASH_KEY = 'khatawas_pin_hash_v1';

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(`khatawas-pin:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toBase64(new Uint8Array(digest));
}

export function hasPinLockEnabled(): boolean {
  try {
    return Boolean(localStorage.getItem(PIN_HASH_KEY));
  } catch {
    return false;
  }
}

export async function setAppPin(pin: string): Promise<void> {
  const hashed = await hashPin(pin);
  localStorage.setItem(PIN_HASH_KEY, hashed);
}

export async function verifyAppPin(pin: string): Promise<boolean> {
  const stored = localStorage.getItem(PIN_HASH_KEY);
  if (!stored) return true;
  const hashed = await hashPin(pin);
  return hashed === stored;
}

export function clearAppPin(): void {
  localStorage.removeItem(PIN_HASH_KEY);
}

export interface FullBackupPayload {
  shops: ShopProfile[];
  activeShopId: string;
  shopDataById: Record<string, ShopLedgerData>;
}

export interface EncryptedBackupEnvelope {
  app: 'KHATAWAS';
  version: 1;
  alg: 'PBKDF2-SHA256+AES-256-GCM';
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
  exportedAt: string;
}

async function deriveAesKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptLedgerBackup(
  payload: FullBackupPayload,
  passphrase: string
): Promise<EncryptedBackupEnvelope> {
  const iterations = 100_000;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(passphrase, salt, iterations);

  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    plaintext
  );

  return {
    app: 'KHATAWAS',
    version: 1,
    alg: 'PBKDF2-SHA256+AES-256-GCM',
    iterations,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(encryptedBuffer)),
    exportedAt: new Date().toISOString(),
  };
}

export async function decryptLedgerBackup(
  rawJsonText: string,
  passphrase: string
): Promise<FullBackupPayload> {
  let envelope: Partial<EncryptedBackupEnvelope>;
  try {
    envelope = JSON.parse(rawJsonText);
  } catch {
    throw new Error('Selected file is not valid JSON.');
  }

  if (
    envelope.app !== 'KHATAWAS' ||
    envelope.version !== 1 ||
    !envelope.salt ||
    !envelope.iv ||
    !envelope.ciphertext
  ) {
    throw new Error('Invalid KHATAWAS encrypted backup format.');
  }

  const salt = fromBase64(envelope.salt);
  const iv = fromBase64(envelope.iv);
  const ciphertext = fromBase64(envelope.ciphertext);
  const iterations = typeof envelope.iterations === 'number' ? envelope.iterations : 100_000;

  let decryptedBuffer: ArrayBuffer;
  try {
    const key = await deriveAesKey(passphrase, salt, iterations);
    decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      ciphertext as BufferSource
    );
  } catch {
    throw new Error('Incorrect passphrase or corrupted backup file.');
  }

  const decodedText = new TextDecoder().decode(decryptedBuffer);
  const payload = JSON.parse(decodedText) as Partial<FullBackupPayload>;

  if (
    !Array.isArray(payload.shops) ||
    payload.shops.length === 0 ||
    typeof payload.activeShopId !== 'string' ||
    !payload.shopDataById ||
    typeof payload.shopDataById !== 'object'
  ) {
    throw new Error('Decrypted backup payload is missing required shop ledger structures.');
  }

  return payload as FullBackupPayload;
}
