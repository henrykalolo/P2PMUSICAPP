import { NextRequest, NextResponse } from 'next/server';
import { ArtistMonetization, MONETIZATION_TIERS } from '@/lib/monetization';
import { verifyToken } from '@/lib/auth/jwt';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const artistId = searchParams.get('artistId');

    const authHeader = request.headers.get('authorization');
    let currentUserId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const payload = await verifyToken(token);
      if (payload) {
        currentUserId = payload.userId;
      }
    }

    if (artistId) {
      const monetization = new ArtistMonetization();
      const result = await monetization.getSubscriberSubscriptions(artistId);
      return NextResponse.json({
        success: true,
        artistId,
        subscriptions: result,
      });
    }

    if (currentUserId) {
      const monetization = new ArtistMonetization();
      const result = await monetization.getSubscriberSubscriptions(currentUserId);
      return NextResponse.json({
        success: true,
        subscriptions: result,
      });
    }

    return NextResponse.json({
      success: true,
      tiers: MONETIZATION_TIERS,
    });
  } catch (error) {
    console.error('Get subscriptions error:', error);
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
    const { artistId, tier, action } = body;

    if (!artistId) {
      return NextResponse.json(
        { error: 'Artist ID is required' },
        { status: 400 }
      );
    }

    const subscriberId = payload.userId;
    const monetization = new ArtistMonetization();

    if (action === 'subscribe' || !action) {
      if (!tier) {
        return NextResponse.json(
          { error: 'Tier is required' },
          { status: 400 }
        );
      }

      const validTier = MONETIZATION_TIERS.find((t) => t.name === tier);
      if (!validTier) {
        return NextResponse.json(
          { error: `Invalid tier: ${tier}` },
          { status: 400 }
        );
      }

      if (subscriberId === artistId) {
        return NextResponse.json(
          { error: 'Cannot subscribe to yourself' },
          { status: 400 }
        );
      }

      const userCheck = await import('@/lib/db').then((m) =>
        m.query('SELECT id FROM users WHERE id = $1', [artistId])
      );

      if (userCheck.rows.length === 0) {
        return NextResponse.json(
          { error: 'Artist not found' },
          { status: 404 }
        );
      }

      const subscription = await monetization.createSubscription(
        artistId,
        tier,
        subscriberId
      );

      return NextResponse.json({
        success: true,
        subscription,
        message: `Subscribed to ${tier} tier`,
      }, { status: 201 });
    }

    if (action === 'cancel') {
      const { subscriptionId } = body;
      if (!subscriptionId) {
        return NextResponse.json(
          { error: 'Subscription ID is required' },
          { status: 400 }
        );
      }

      await monetization.cancelSubscription(subscriptionId);

      return NextResponse.json({
        success: true,
        message: 'Subscription cancelled',
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Subscription management error:', error);
    if (error instanceof Error && error.message.includes('already exists')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
