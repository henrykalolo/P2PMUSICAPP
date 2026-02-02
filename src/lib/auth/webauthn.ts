import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  GenerateRegistrationOptionsOpts,
  GenerateAuthenticationOptionsOpts,
  VerifiedRegistrationResponse,
  VerifiedAuthenticationResponse,
} from '@simplewebauthn/server';

const rpID = process.env.WEBAUTHN_RP_ID || 'localhost';
const rpName = process.env.WEBAUTHN_RP_NAME || 'P2P Music Platform';
const origin = process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000';

/**
 * Generate registration options for a new user
 */
export async function generateRegisterOptions(
  userId: string,
  username: string
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: new TextEncoder().encode(userId),
    userName: username,
    attestationType: 'none',
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
      authenticatorAttachment: 'platform',
    },
  });

  return options;
}

/**
 * Verify registration response
 */
export async function verifyRegister(
  response: unknown,
  expectedChallenge: string
): Promise<VerifiedRegistrationResponse> {
  const verification = await verifyRegistrationResponse({
    response: response as Parameters<typeof verifyRegistrationResponse>[0]['response'],
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
  });

  return verification;
}

/**
 * Generate authentication options
 */
export async function generateAuthOptions(
  allowCredentials?: { id: string; type: 'public-key' }[]
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials,
    userVerification: 'preferred',
  });

  return options;
}

/**
 * Verify authentication response
 */
export async function verifyAuth(
  response: unknown,
  expectedChallenge: string,
  credentialPublicKey: Uint8Array,
  credentialCounter: number
): Promise<VerifiedAuthenticationResponse> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const verification = await verifyAuthenticationResponse({
    response: response as Parameters<typeof verifyAuthenticationResponse>[0]['response'],
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: {
      id: new Uint8Array(),
      publicKey: credentialPublicKey,
      counter: credentialCounter,
    },
  } as any);

  return verification;
}
