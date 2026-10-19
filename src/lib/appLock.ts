/**
 * App lock (SPEC §8.10): a 4–6 digit PIN and optionally a passkey gate the UI on open.
 * This is a screen lock, not encryption — data in IndexedDB stays readable to anyone with access to the
 * browser profile. Everything runs locally: the PIN is stored only as a salted PBKDF2 hash, and the
 * passkey assertion is verified against the stored public key with WebCrypto.
 */

import type { AppLockConfig, PasskeyConfig, PinHash } from '@/domain/appLock';

export type { AppLockConfig, PasskeyConfig, PinHash };

export const PIN_RE = /^\d{4,6}$/;
const ITERATIONS = 210_000; // OWASP 2023 guidance for PBKDF2-HMAC-SHA256

// ── base64 / base64url ──
export const toB64 = (buf: ArrayBuffer | Uint8Array) =>
  btoa(
    String.fromCharCode(...new Uint8Array(buf instanceof Uint8Array ? buf : new Uint8Array(buf))),
  );
export const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const toB64Url = (buf: ArrayBuffer | Uint8Array) =>
  toB64(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));

async function pbkdf2(pin: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export async function hashPin(pin: string, iterations = ITERATIONS): Promise<PinHash> {
  if (!PIN_RE.test(pin)) throw new Error('PIN must be 4–6 digits');
  const salt = randomBytes(16);
  return { salt: toB64(salt), hash: toB64(await pbkdf2(pin, salt, iterations)), iterations };
}

export async function verifyPin(pin: string, stored: PinHash): Promise<boolean> {
  if (!PIN_RE.test(pin)) return false;
  const actual = await pbkdf2(pin, fromB64(stored.salt), stored.iterations);
  const expected = fromB64(stored.hash);
  // Constant-time comparison.
  let diff = actual.length ^ expected.length;
  for (let i = 0; i < Math.max(actual.length, expected.length); i++)
    diff |= (actual[i] ?? 0) ^ (expected[i] ?? 0);
  return diff === 0;
}

// ── Passkey (WebAuthn, local verification) ──

export async function passkeyAvailable(): Promise<boolean> {
  try {
    return (
      typeof PublicKeyCredential !== 'undefined' &&
      (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
    );
  } catch {
    return false;
  }
}

export async function createPasskey(): Promise<PasskeyConfig> {
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: randomBytes(32),
      rp: { name: 'Kin', id: location.hostname },
      user: { id: randomBytes(16), name: 'kin', displayName: 'Kin app lock' },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'discouraged',
      },
      timeout: 60_000,
      attestation: 'none',
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error('No credential');
  const res = cred.response as AuthenticatorAttestationResponse;
  const spki = res.getPublicKey();
  if (!spki) throw new Error('Unsupported authenticator');
  return {
    credentialId: toB64(cred.rawId),
    publicKey: toB64(spki),
    alg: res.getPublicKeyAlgorithm(),
  };
}

/** Convert a DER ECDSA signature to the raw r‖s form WebCrypto expects (P-256: 32 + 32 bytes). */
export function derToRaw(der: Uint8Array): Uint8Array {
  let i = 2; // skip SEQUENCE tag + length
  const read = () => {
    i++; // INTEGER tag
    const len = der[i++]!;
    let v = der.slice(i, i + len);
    i += len;
    while (v.length > 32 && v[0] === 0) v = v.slice(1); // strip sign padding
    const out = new Uint8Array(32);
    out.set(v, 32 - v.length);
    return out;
  };
  const r = read();
  const s = read();
  const raw = new Uint8Array(64);
  raw.set(r, 0);
  raw.set(s, 32);
  return raw;
}

export interface Assertion {
  authenticatorData: Uint8Array;
  clientDataJSON: Uint8Array;
  signature: Uint8Array;
}

/**
 * Verify a WebAuthn assertion locally: client data type, challenge and origin, user-verified flag, and the
 * signature over `authenticatorData ‖ SHA-256(clientDataJSON)` with the stored public key.
 */
export async function verifyAssertion(
  a: Assertion,
  cfg: PasskeyConfig,
  challenge: Uint8Array,
  origin: string,
): Promise<boolean> {
  try {
    const client = JSON.parse(new TextDecoder().decode(a.clientDataJSON)) as {
      type: string;
      challenge: string;
      origin: string;
    };
    if (
      client.type !== 'webauthn.get' ||
      client.challenge !== toB64Url(challenge) ||
      client.origin !== origin
    )
      return false;
    const flags = a.authenticatorData[32] ?? 0;
    if (!(flags & 0x01) || !(flags & 0x04)) return false; // user present + user verified
    const clientHash = new Uint8Array(await crypto.subtle.digest('SHA-256', a.clientDataJSON));
    const signed = new Uint8Array(a.authenticatorData.length + clientHash.length);
    signed.set(a.authenticatorData, 0);
    signed.set(clientHash, a.authenticatorData.length);
    if (cfg.alg === -7) {
      const key = await crypto.subtle.importKey(
        'spki',
        fromB64(cfg.publicKey),
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify'],
      );
      return crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        key,
        derToRaw(a.signature),
        signed,
      );
    }
    if (cfg.alg === -257) {
      const key = await crypto.subtle.importKey(
        'spki',
        fromB64(cfg.publicKey),
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify'],
      );
      return crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, a.signature, signed);
    }
    return false;
  } catch {
    return false;
  }
}

export async function unlockWithPasskey(cfg: PasskeyConfig): Promise<boolean> {
  const challenge = randomBytes(32);
  const cred = (await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [{ type: 'public-key', id: fromB64(cfg.credentialId) }],
      userVerification: 'required',
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;
  if (!cred) return false;
  const res = cred.response as AuthenticatorAssertionResponse;
  return verifyAssertion(
    {
      authenticatorData: new Uint8Array(res.authenticatorData),
      clientDataJSON: new Uint8Array(res.clientDataJSON),
      signature: new Uint8Array(res.signature),
    },
    cfg,
    challenge,
    location.origin,
  );
}

// ── Attempt throttling (persisted so a reload doesn't reset it) ──
const ATTEMPTS_KEY = 'kin.lockAttempts';
export const MAX_ATTEMPTS = 5;
export const COOLDOWN_MS = 30_000;

export function lockoutRemaining(now = Date.now()): number {
  try {
    const { count, at } = JSON.parse(
      localStorage.getItem(ATTEMPTS_KEY) ?? '{"count":0,"at":0}',
    ) as { count: number; at: number };
    return count >= MAX_ATTEMPTS ? Math.max(0, at + COOLDOWN_MS - now) : 0;
  } catch {
    return 0;
  }
}

export function recordFailure(now = Date.now()): void {
  try {
    const cur = JSON.parse(localStorage.getItem(ATTEMPTS_KEY) ?? '{"count":0,"at":0}') as {
      count: number;
    };
    const count = cur.count >= MAX_ATTEMPTS ? 1 : cur.count + 1; // a new round after the cool-down
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify({ count, at: now }));
  } catch {
    // ignore
  }
}

export function clearFailures(): void {
  try {
    localStorage.removeItem(ATTEMPTS_KEY);
  } catch {
    // ignore
  }
}
