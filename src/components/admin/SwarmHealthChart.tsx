'use client';

interface PeerData {
  uts: number; // User Trust Score
  id: string;
  username: string;
}

interface SwarmHealthChartProps {
  peers: PeerData[];
}

/** Lightweight distribution bars (no external chart dependency). */
export function SwarmHealthChart({ peers }: SwarmHealthChartProps) {
  const data = [
    {
      name: 'Guardians (High Trust)',
      value: peers.filter((p) => p.uts > 60).length,
      color: '#22c55e',
    },
    {
      name: 'Nodes (Mutuals)',
      value: peers.filter((p) => p.uts > 20 && p.uts <= 60).length,
      color: '#3b82f6',
    },
    {
      name: 'Listeners (Ephemeral)',
      value: peers.filter((p) => p.uts <= 20).length,
      color: '#94a3b8',
    },
  ];

  const totalPeers = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Swarm Distribution</h3>
      <div className="space-y-3">
        {data.map((entry) => {
          const percent = totalPeers > 0 ? Math.round((entry.value / totalPeers) * 100) : 0;
          return (
            <div key={entry.name}>
              <div className="flex justify-between text-xs text-gray-300 mb-1">
                <span>{entry.name}</span>
                <span>
                  {entry.value} ({percent}%)
                </span>
              </div>
              <div className="h-2 w-full rounded bg-gray-700">
                <div
                  className="h-2 rounded"
                  style={{ width: `${percent}%`, backgroundColor: entry.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-sm text-gray-400 mt-4">Total Peers: {totalPeers}</p>
    </div>
  );
}

export default SwarmHealthChart;
