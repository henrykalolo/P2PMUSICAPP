import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-at-least-32-characters-long'
);

export interface JWTPayload {
  userId: string;
  username: string;
  role: string;
  onboardingCompleted: boolean;
}

/**
 * Create a JWT token
 */
export async function createToken(payload: JWTPayload): Promise<string> {
  const token = await new SignJWT({
    userId: payload.userId,
    username: payload.username,
    role: payload.role,
    onboardingCompleted: payload.onboardingCompleted,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);

  return token;
}

/**
 * Verify a JWT token
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      userId: payload.userId as string,
      username: payload.username as string,
      role: payload.role as string,
      onboardingCompleted: payload.onboardingCompleted as boolean,
    };
  } catch {
    return null;
  }
}
