import { NextRequest, NextResponse } from 'next/server';
import { initIPFS, isIPFSSupported, getHelia } from '@/lib/ipfs/client';

// GET /api/ipfs/status - Check IPFS node status
export async function GET(request: NextRequest) {
  try {
    // Check if IPFS is supported
    if (!isIPFSSupported()) {
      return NextResponse.json({
        supported: false,
        initialized: false,
        error: 'IPFS is not supported in this environment',
      });
    }

    // Try to get existing instance or initialize
    let helia;
    try {
      helia = getHelia();
    } catch {
      // Not initialized yet, that's ok
      return NextResponse.json({
        supported: true,
        initialized: false,
        peerId: null,
        connections: 0,
      });
    }

    // Get peer info
    const peerId = helia.libp2p.peerId.toString();
    
    // Get connection count
    const connections = helia.libp2p.getConnections().length;

    // Get pinned content count
    let pinnedCount = 0;
    try {
      for await (const _ of helia.pins.ls()) {
        pinnedCount++;
      }
    } catch {
      // Ignore errors when counting pins
    }

    return NextResponse.json({
      supported: true,
      initialized: true,
      peerId,
      connections,
      pinnedCount,
      protocols: Array.from(helia.libp2p.getProtocols()),
    });
  } catch (error) {
    console.error('IPFS status error:', error);
    return NextResponse.json(
      {
        supported: false,
        initialized: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}