import { SignJWT, jwtVerify } from 'jose';

/**
 * JWT signing key.
 *
 * There is intentionally no fallback: a deployment with a missing or weak
 * JWT_SECRET must fail to boot rather than silently signing insecure tokens.
 */
function loadSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured. Generate one with: openssl rand -hex 32');
  }
  if (secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long.');
  }
  return new TextEncoder().encode(secret);
}

let cachedSecret: Uint8Array | null = null;
function getSecret(): Uint8Array {
  if (!cachedSecret) cachedSecret = loadSecret();
  return cachedSecret;
}

export interface JWTPayload {
  userId: string;
  username: string;
  role: string;
  onboardingCompleted: boolean;
}

export async function createToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({
    userId: payload.userId,
    username: payload.username,
    role: payload.role,
    onboardingCompleted: payload.onboardingCompleted,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] });
    if (
      typeof payload.userId !== 'string' ||
      typeof payload.username !== 'string' ||
      typeof payload.role !== 'string' ||
      typeof payload.onboardingCompleted !== 'boolean'
    ) {
      return null;
    }
    return {
      userId: payload.userId,
      username: payload.username,
      role: payload.role,
      onboardingCompleted: payload.onboardingCompleted,
    };
  } catch {
    return null;
  }
}
