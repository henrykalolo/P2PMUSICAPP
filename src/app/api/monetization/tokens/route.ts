import { NextRequest, NextResponse } from 'next/server';
import { TokenEconomy } from '@/lib/monetization/TokenEconomy';
import { verifyToken } from '@/lib/auth/jwt';

const tokenEconomy = new TokenEconomy();

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
    const action = searchParams.get('action');

    if (action === 'balance') {
      const balance = await tokenEconomy.getUserTokenBalance(payload.userId);
      return NextResponse.json({
        success: true,
        balance,
      });
    }

    if (action === 'transactions') {
      const limit = parseInt(searchParams.get('limit') || '50');
      const transactions = await tokenEconomy.getUserTokenTransactions(payload.userId, limit);
      return NextResponse.json({
        success: true,
        transactions,
      });
    }

    if (action === 'config') {
      return NextResponse.json({
        success: true,
        config: tokenEconomy.getConfig(),
      });
    }

    if (action === 'distributions') {
      const limit = parseInt(searchParams.get('limit') || '50');
      const distributions = await tokenEconomy.getDistributionRecords(payload.userId, limit);
      return NextResponse.json({
        success: true,
        distributions,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Token economy API',
      endpoints: {
        balance: 'GET /api/monetization/tokens?action=balance',
        transactions: 'GET /api/monetization/tokens?action=transactions',
        config: 'GET /api/monetization/tokens?action=config',
        distributions: 'GET /api/monetization/tokens?action=distributions',
      },
    });
  } catch (error) {
    console.error('Token economy API error:', error);
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
    const { action, ...params } = body;

    if (action === 'award_streamer_bonus') {
      const { minutesListened } = params;
      if (typeof minutesListened !== 'number' || minutesListened <= 0) {
        return NextResponse.json(
          { error: 'Valid minutesListened is required' },
          { status: 400 }
        );
      }

      await tokenEconomy.awardListenerBonus(payload.userId, minutesListened);

      return NextResponse.json({
        success: true,
        message: `Awarded ${minutesListened} minutes of listener bonus`,
      });
    }

    if (action === 'award_seeder_reward') {
      const { bytesServed } = params;
      if (typeof bytesServed !== 'number' || bytesServed <= 0) {
        return NextResponse.json(
          { error: 'Valid bytesServed is required' },
          { status: 400 }
        );
      }

      const reward = await tokenEconomy.awardSeederReward(payload.userId, bytesServed);

      return NextResponse.json({
        success: true,
        reward,
        message: `Awarded ${reward} tokens for seeding ${bytesServed} bytes`,
      });
    }

    if (action === 'distribute_creator_rewards') {
      const { trackId, streamCount, creatorWallet } = params;
      if (!trackId || !creatorWallet) {
        return NextResponse.json(
          { error: 'trackId and creatorWallet are required' },
          { status: 400 }
        );
      }

      const result = await tokenEconomy.distributeCreatorRewards(
        trackId,
        streamCount || 0,
        creatorWallet
      );

      return NextResponse.json({
        success: true,
        result,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Token economy POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
