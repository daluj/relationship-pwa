// @vitest-environment node
import {
  clearFailures,
  derToRaw,
  hashPin,
  lockoutRemaining,
  recordFailure,
  toB64,
  verifyAssertion,
  verifyPin,
  type PasskeyConfig,
} from '@/lib/appLock';

describe('PIN (features §8.10)', () => {
  it('stores a salted hash, verifies the right PIN only', async () => {
    const h = await hashPin('482915', 1000);
    expect(h.hash).not.toContain('482915');
    expect(await verifyPin('482915', h)).toBe(true);
    expect(await verifyPin('482916', h)).toBe(false);
    expect(await verifyPin('48291', h)).toBe(false);
    expect((await hashPin('482915', 1000)).salt).not.toBe(h.salt); // random salt
  });
  it('only accepts 4–6 digits', async () => {
    await expect(hashPin('123')).rejects.toThrow();
    await expect(hashPin('abcd')).rejects.toThrow();
    await expect(hashPin('1234567')).rejects.toThrow();
  });
});

/** Encode raw r‖s as DER, the way authenticators return ECDSA signatures. */
function rawToDer(raw: Uint8Array): Uint8Array {
  const int = (b: Uint8Array) => {
    let v = Array.from(b);
    while (v.length > 1 && v[0] === 0 && v[1]! < 0x80) v = v.slice(1);
    if (v[0]! >= 0x80) v = [0, ...v];
    return [0x02, v.length, ...v];
  };
  const body = [...int(raw.slice(0, 32)), ...int(raw.slice(32))];
  return new Uint8Array([0x30, body.length, ...body]);
}

const b64url = (b: Uint8Array) =>
  toB64(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function assertion(
  alg: -7 | -257,
  opts: { flags?: number; origin?: string; challengeOverride?: Uint8Array } = {},
) {
  const keys =
    alg === -7
      ? await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
          'sign',
          'verify',
        ])
      : await crypto.subtle.generateKey(
          {
            name: 'RSASSA-PKCS1-v1_5',
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: 'SHA-256',
          },
          true,
          ['sign', 'verify'],
        );
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const authenticatorData = new Uint8Array(37);
  authenticatorData[32] = opts.flags ?? 0x05; // UP + UV
  const clientDataJSON = new TextEncoder().encode(
    JSON.stringify({
      type: 'webauthn.get',
      challenge: b64url(opts.challengeOverride ?? challenge),
      origin: opts.origin ?? 'http://localhost:4173',
    }),
  );
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', clientDataJSON));
  const signed = new Uint8Array([...authenticatorData, ...hash]);
  const sig = new Uint8Array(
    alg === -7
      ? await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keys.privateKey, signed)
      : await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keys.privateKey, signed),
  );
  const cfg: PasskeyConfig = {
    credentialId: 'x',
    publicKey: toB64(await crypto.subtle.exportKey('spki', keys.publicKey)),
    alg,
  };
  return {
    a: { authenticatorData, clientDataJSON, signature: alg === -7 ? rawToDer(sig) : sig },
    cfg,
    challenge,
  };
}

describe('passkey assertion verification', () => {
  const origin = 'http://localhost:4173';

  it.each([-7, -257] as const)('accepts a valid assertion (alg %i)', async (alg) => {
    const { a, cfg, challenge } = await assertion(alg);
    expect(await verifyAssertion(a, cfg, challenge, origin)).toBe(true);
  });

  it('rejects a wrong challenge, origin, missing user verification, or tampered data', async () => {
    const ok = await assertion(-7);
    expect(
      await verifyAssertion(ok.a, ok.cfg, crypto.getRandomValues(new Uint8Array(32)), origin),
    ).toBe(false);
    expect(await verifyAssertion(ok.a, ok.cfg, ok.challenge, 'https://evil.example')).toBe(false);
    const tampered = {
      ...ok.a,
      authenticatorData: Uint8Array.from(ok.a.authenticatorData, (b, i) => (i === 0 ? b ^ 1 : b)),
    };
    expect(await verifyAssertion(tampered, ok.cfg, ok.challenge, origin)).toBe(false);
    const noUv = await assertion(-7, { flags: 0x01 });
    expect(await verifyAssertion(noUv.a, noUv.cfg, noUv.challenge, origin)).toBe(false);
    const other = await assertion(-7);
    expect(await verifyAssertion(ok.a, other.cfg, ok.challenge, origin)).toBe(false); // different key
  });

  it('derToRaw handles sign-padded integers', () => {
    const raw = new Uint8Array(64).map((_, i) => (i === 0 || i === 32 ? 0xff : i));
    expect(derToRaw(rawToDer(raw))).toEqual(raw);
  });
});

describe('attempt throttling', () => {
  const store = new Map<string, string>();
  beforeAll(() => {
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
  });
  it('locks out for 30 s after 5 failures', () => {
    clearFailures();
    for (let i = 0; i < 4; i++) recordFailure(1000);
    expect(lockoutRemaining(1000)).toBe(0);
    recordFailure(1000);
    expect(lockoutRemaining(1000)).toBe(30_000);
    expect(lockoutRemaining(31_000)).toBe(0);
    clearFailures();
    expect(lockoutRemaining(1000)).toBe(0);
  });
});
