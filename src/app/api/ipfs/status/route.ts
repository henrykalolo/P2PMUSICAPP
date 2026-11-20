import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/ipfs/status - report whether the browser IPFS client can be used.
 * Helia/libp2p is loaded lazily so this endpoint can never break the build or
 * core server-side upload/playback paths.
 */
export async function GET(_request: NextRequest) {
  if (typeof window === 'undefined') {
    return NextResponse.json({
      supported: false,
      initialized: false,
      reason: 'IPFS runs in the browser; server-side IPFS is optional and not enabled by default.',
    });
  }

  try {
    const { isIPFSSupported, getHelia } = await import('@/lib/ipfs/client');
    if (!isIPFSSupported()) {
      return NextResponse.json({ supported: false, initialized: false });
    }

    let helia;
    try {
      helia = await getHelia();
    } catch {
      return NextResponse.json({ supported: true, initialized: false, peerId: null, connections: 0 });
    }

    let pinnedCount = 0;
    try {
      for await (const _ of helia.pins.ls()) pinnedCount++;
    } catch {
      // Pin listing is best-effort.
    }

    return NextResponse.json({
      supported: true,
      initialized: true,
      peerId: helia.libp2p.peerId.toString(),
      connections: helia.libp2p.getConnections().length,
      pinnedCount,
      protocols: Array.from(helia.libp2p.getProtocols()),
    });
  } catch (error) {
    return NextResponse.json({
      supported: false,
      initialized: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
