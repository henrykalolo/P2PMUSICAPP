'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface PeerData {
  uts: number; // User Trust Score
  id: string;
  username: string;
}

interface SwarmHealthChartProps {
  peers: PeerData[];
}

export function SwarmHealthChart({ peers }: SwarmHealthChartProps) {
  const data = [
    { 
      name: 'Guardians (High Trust)', 
      value: peers.filter(p => p.uts > 60).length, 
      color: '#22c55e' 
    },
    { 
      name: 'Nodes (Mutuals)', 
      value: peers.filter(p => p.uts > 20 && p.uts <= 60).length, 
      color: '#3b82f6' 
    },
    { 
      name: 'Listeners (Ephemeral)', 
      value: peers.filter(p => p.uts <= 20).length, 
      color: '#94a3b8' 
    },
  ];

  const totalPeers = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Swarm Distribution</h3>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
              label={({ name, percent }) => `${name.split(' ')[0]} ${(percent * 100).toFixed(0)}%`}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1f2937', 
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#f3f4f6'
              }}
              formatter={(value: number) => [value, 'Peers']}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="text-center mt-2">
        <p className="text-sm font-medium text-gray-600">
          Total Peers: {totalPeers}
        </p>
      </div>
      
      {/* Legend */}
      <div className="mt-4 flex justify-center gap-4">
        {data.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-xs text-gray-400">{entry.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SwarmHealthChart;
