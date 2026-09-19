import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { query } from '@/lib/db';
import { PayoutMethod } from '@/types/monetization';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token);

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const result = await query(
      `SELECT monetization_enabled, payout_method, payout_schedule,
              crypto_wallet, stripe_account_id
       FROM artist_settings
       WHERE artist_id = $1`,
      [payload.userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: true,
        settings: {
          monetizationEnabled: false,
          payoutMethod: 'stripe',
          payoutSchedule: 'instant',
        },
      });
    }

    const row = result.rows[0];
    return NextResponse.json({
      success: true,
      settings: {
        monetizationEnabled: row.monetization_enabled,
        payoutMethod: row.payout_method,
        payoutSchedule: row.payout_schedule,
        hasWallet: !!row.crypto_wallet,
        hasStripeAccount: !!row.stripe_account_id,
      },
    });
  } catch (error) {
    console.error('Get artist settings error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token);

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { monetizationEnabled, payoutMethod, payoutSchedule, cryptoWallet, stripeAccountId, paypalEmail } = body;

    const validMethods: PayoutMethod[] = ['stripe', 'paypal', 'crypto_wallet', 'platform_credit'];
    if (payoutMethod && !validMethods.includes(payoutMethod)) {
      return NextResponse.json(
        { error: 'Invalid payout method' },
        { status: 400 }
      );
    }

    await query(
      `INSERT INTO artist_settings
       (artist_id, monetization_enabled, payout_method, payout_schedule,
        crypto_wallet, stripe_account_id, paypal_email, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       ON CONFLICT (artist_id) DO UPDATE SET
         monetization_enabled = EXCLUDED.monetization_enabled,
         payout_method = EXCLUDED.payout_method,
         payout_schedule = EXCLUDED.payout_schedule,
         crypto_wallet = EXCLUDED.crypto_wallet,
         stripe_account_id = EXCLUDED.stripe_account_id,
         paypal_email = EXCLUDED.paypal_email,
         updated_at = NOW()`,
      [
        payload.userId,
        monetizationEnabled ?? false,
        payoutMethod || 'stripe',
        payoutSchedule || 'instant',
        cryptoWallet || null,
        stripeAccountId || null,
        paypalEmail || null,
      ]
    );

    return NextResponse.json({
      success: true,
      message: 'Artist settings updated',
    });
  } catch (error) {
    console.error('Update artist settings error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
