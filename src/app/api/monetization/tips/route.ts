import { NextRequest, NextResponse } from 'next/server';
import { TipSystem, DEFAULT_TIP_CONFIG } from '@/lib/monetization/TipSystem';
import { verifyToken } from '@/lib/auth/jwt';

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

    const { searchParams } = new URL(request.url);
    const artistId = searchParams.get('artistId');

    const tipSystem = new TipSystem();

    if (artistId) {
      const tips = await tipSystem.getTipsReceived(artistId);
      return NextResponse.json({
        success: true,
        tips,
      });
    }

    const [sentTips, stats] = await Promise.all([
      tipSystem.getTipsSent(payload.userId),
      tipSystem.getTippingStats(payload.userId),
    ]);

    return NextResponse.json({
      success: true,
      sentTips,
      stats,
    });
  } catch (error) {
    console.error('Get tips error:', error);
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
    const { artistId, amount, currency, message } = body;

    if (!artistId) {
      return NextResponse.json(
        { error: 'Artist ID is required' },
        { status: 400 }
      );
    }

    if (!amount || typeof amount !== 'number') {
      return NextResponse.json(
        { error: 'Valid amount is required' },
        { status: 400 }
      );
    }

    if (!currency) {
      return NextResponse.json(
        { error: 'Currency is required' },
        { status: 400 }
      );
    }

    const tipSystem = new TipSystem();

    if (amount < tipSystem.config.minTipAmount || amount > tipSystem.config.maxTipAmount) {
      return NextResponse.json(
        {
          error: `Tip amount must be between ${tipSystem.config.minTipAmount} and ${tipSystem.config.maxTipAmount}`,
        },
        { status: 400 }
      );
    }

    if (!tipSystem.config.supportedCurrencies.includes(currency as any)) {
      return NextResponse.json(
        { error: `Unsupported currency: ${currency}` },
        { status: 400 }
      );
    }

    if (payload.userId === artistId) {
      return NextResponse.json(
        { error: 'Cannot tip yourself' },
        { status: 400 }
      );
    }

    const result = await tipSystem.processTip(
      payload.userId,
      artistId,
      amount,
      currency,
      message
    );

    return NextResponse.json({
      success: true,
      tip: result,
    });
  } catch (error) {
    console.error('Process tip error:', error);
    if (error instanceof Error) {
      if (error.message.includes('balance')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
      if (error.message.includes('Currency') || error.message.includes('amount')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'enable-instant-payout') {
      const tipSystem = new TipSystem();
      await tipSystem.enableInstantPayout(payload.userId);
      return NextResponse.json({
        success: true,
        message: 'Instant payout enabled',
      });
    }

    if (action === 'config') {
      const tipSystem = new TipSystem();
      return NextResponse.json({
        success: true,
        config: tipSystem.getConfig(),
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Tip management error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
