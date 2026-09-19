import { NextRequest, NextResponse } from 'next/server';
import { ArtistMonetization, TipSystem, MONETIZATION_TIERS } from '@/lib/monetization';
import { verifyToken } from '@/lib/auth/jwt';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const artistId = searchParams.get('artistId');
    const timeRange = searchParams.get('timeRange') || '30d';

    if (artistId) {
      const authHeader = request.headers.get('authorization');
      let authorized = false;

      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        const payload = await verifyToken(token);
        if (payload && payload.userId === artistId) {
          authorized = true;
        }
      }

      if (!authorized) {
        return NextResponse.json(
          { error: 'Unauthorized to view this artist\'s monetization stats' },
          { status: 401 }
        );
      }

      const monetization = new ArtistMonetization();
      const tipSystem = new TipSystem()

      const [revenue, activeSubscriptions, tips] = await Promise.all([
        monetization.getArtistRevenue(artistId, 100),
        monetization.getActiveSubscriptions(artistId, new Date()),
        tipSystem.getTippingStats(artistId),
      ]);

      const tierMap = new Map(MONETIZATION_TIERS.map((t) => [t.name, t]));
      const tierBreakdown: Record<string, { count: number; revenue: number }> = {};

      for (const sub of activeSubscriptions) {
        const tier = tierMap.get(sub.tier);
        if (tier) {
          if (!tierBreakdown[sub.tier]) {
            tierBreakdown[sub.tier] = { count: 0, revenue: 0 };
          }
          tierBreakdown[sub.tier].count += 1;
          tierBreakdown[sub.tier].revenue += sub.creatorShare;
        }
      }

      return NextResponse.json({
        success: true,
        artistId,
        stats: {
          tiers: tierBreakdown,
          activeSubscribers: activeSubscriptions.length,
          totalRevenue: revenue.reduce((sum, tx) => sum + Number(tx.amount), 0),
          recentTransactions: revenue,
          tips: tips,
        },
      });
    }

    return NextResponse.json({
      success: true,
      tiers: MONETIZATION_TIERS,
      config: {
        timeRange,
      },
    });
  } catch (error) {
    console.error('Get monetization stats error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
