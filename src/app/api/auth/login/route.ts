import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { generateAuthOptions, verifyAuth } from '@/lib/auth/webauthn';
import { createToken } from '@/lib/auth/jwt';

// In-memory challenge storage (use Redis in production)
const challenges = new Map<string, string>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, action, response } = body;

    // Step 1: Generate authentication options
    if (action === 'init') {
      // Find user by username
      const userResult = await query(
        'SELECT id, username, role, onboarding_completed FROM users WHERE username = $1',
        [username]
      );

      if (userResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      const user = userResult.rows[0];

      // Get user's credentials
      const credentialsResult = await query(
        'SELECT credential_id, public_key, counter FROM webauthn_credentials WHERE user_id = $1',
        [user.id]
      );

      const allowCredentials = credentialsResult.rows.map((cred) => ({
        id: cred.credential_id,
        type: 'public-key' as const,
      }));

      const options = await generateAuthOptions(allowCredentials);
      
      // Store challenge for verification
      challenges.set(user.id, options.challenge);
      
      return NextResponse.json({
        options,
        userId: user.id,
      });
    }

    // Step 2: Verify authentication
    if (action === 'verify') {
      const { userId, credential } = response;
      const expectedChallenge = challenges.get(userId);
      
      if (!expectedChallenge) {
        return NextResponse.json(
          { error: 'Challenge not found or expired' },
          { status: 400 }
        );
      }

      // Get credential info
      const credentialResult = await query(
        'SELECT public_key, counter FROM webauthn_credentials WHERE credential_id = $1',
        [credential.id]
      );

      if (credentialResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'Credential not found' },
          { status: 404 }
        );
      }

      const credentialInfo = credentialResult.rows[0];
      const publicKey = Buffer.from(credentialInfo.public_key, 'base64');

      const verification = await verifyAuth(
        credential,
        expectedChallenge,
        publicKey,
        credentialInfo.counter
      );
      
      if (!verification.verified) {
        return NextResponse.json(
          { error: 'Authentication verification failed' },
          { status: 400 }
        );
      }

      // Update counter
      await query(
        'UPDATE webauthn_credentials SET counter = $1 WHERE credential_id = $2',
        [verification.authenticationInfo.newCounter, credential.id]
      );

      // Get user info
      const userResult = await query(
        'SELECT id, username, email, role, onboarding_completed FROM users WHERE id = $1',
        [userId]
      );

      const user = userResult.rows[0];

      // Generate JWT token
      const token = await createToken({
        userId: user.id,
        username: user.username,
        role: user.role,
        onboardingCompleted: user.onboarding_completed,
      });

      // Clean up challenge
      challenges.delete(userId);

      return NextResponse.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          onboardingCompleted: user.onboarding_completed,
        },
        token,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
