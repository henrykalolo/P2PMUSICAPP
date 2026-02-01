import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { generateRegisterOptions, verifyRegister } from '@/lib/auth/webauthn';
import { createToken } from '@/lib/auth/jwt';
import { v4 as uuidv4 } from 'uuid';

// In-memory challenge storage (use Redis in production)
const challenges = new Map<string, string>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, email, action, response } = body;

    // Step 1: Generate registration options
    if (action === 'init') {
      const userId = uuidv4();
      const options = await generateRegisterOptions(userId, username);
      
      // Store challenge for verification
      challenges.set(userId, options.challenge);
      
      return NextResponse.json({
        options,
        userId,
      });
    }

    // Step 2: Verify registration
    if (action === 'verify') {
      const { userId, credential } = response;
      const expectedChallenge = challenges.get(userId);
      
      if (!expectedChallenge) {
        return NextResponse.json(
          { error: 'Challenge not found or expired' },
          { status: 400 }
        );
      }

      const verification = await verifyRegister(credential, expectedChallenge);
      
      if (!verification.verified || !verification.registrationInfo) {
        return NextResponse.json(
          { error: 'Registration verification failed' },
          { status: 400 }
        );
      }

      // Check if this is one of the first 11 users (founder users)
      const userCountResult = await query('SELECT COUNT(*) FROM users');
      const userCount = parseInt(userCountResult.rows[0].count);
      const isFounderUser = userCount < 11;

      // Create user in database
      const userResult = await query(
        `INSERT INTO users (
          id, username, email, is_artist, can_upload, 
          onboarding_completed, is_founder_user
        ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [
          userId,
          username,
          email,
          true, // is_artist
          isFounderUser, // can_upload (founders can upload immediately)
          isFounderUser, // onboarding_completed (founders skip onboarding)
          isFounderUser,
        ]
      );

      const user = userResult.rows[0];

      // Store WebAuthn credential
      await query(
        `INSERT INTO webauthn_credentials (
          user_id, credential_id, public_key, counter, 
          device_type, backed_up, transports
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          userId,
          verification.registrationInfo.credential.id,
          Buffer.from(verification.registrationInfo.credential.publicKey).toString('base64'),
          verification.registrationInfo.credential.counter,
          verification.registrationInfo.credentialDeviceType,
          verification.registrationInfo.credentialBackedUp,
          verification.registrationInfo.credential.transports || [],
        ]
      );

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
          isFounderUser: user.is_founder_user,
        },
        token,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
