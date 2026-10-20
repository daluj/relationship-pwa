/** App lock settings (features §8.10). Logic lives in `lib/appLock.ts`. */

export interface PinHash {
  salt: string;
  hash: string;
  iterations: number;
}

export interface PasskeyConfig {
  credentialId: string;
  /** SPKI DER, base64. */
  publicKey: string;
  /** COSE algorithm: -7 (ES256) or -257 (RS256). */
  alg: number;
}

export interface AppLockConfig {
  pin: PinHash;
  passkey?: PasskeyConfig;
  /** Lock again after the app has been hidden this long. */
  lockAfterMinutes: number;
}
