import React, { useState, useMemo } from 'react';
import { Crosshair } from 'lucide-react';
import { StatsData } from './StatsData';

interface EmotionalRadarProps {
  stats: StatsData;
}

// How many emotion axes to show (max)
const MAX_AXES = 8;

// Colors for the radar
const RADAR_COLOR = '#a78bfa'; // violet
const RADAR_BG = 'rgba(167, 139, 250, 0.15)';
const GRID_COLOR = 'rgba(255, 255, 255, 0.06)';
const LABEL_COLOR = 'rgba(255, 255, 255, 0.7)';

// Short labels for display (maps long emotion names to short forms)
const SHORT_LABELS: Record<string, string> = {
  'Corazón Roto': '💔 Corazón',
  'Perfecto': '✨ Perfecto',
  'Entrañables': '🫂 Entrañables',
  'Adictivo': '💉 Adictivo',
  'Arte Increíble': '🎨 Arte',
  'Soundtrack': '🎵 Sound',
  'Mucha Risa': '🤣 Risa',
  'Miedo/Ansiedad': '😨 Miedo',
  'Giro Impactante': '🤯 Giro',
  'Ritmo Impecable': '⚡ Ritmo',
  'Mundo Épico': '🌍 Mundo',
  'Reflexivo': '🤔 Reflexión',
  'Desafiante': '🧩 Desafío',
  'Adrenalina': '🔥 Adrenalina',
  'Para Maratón': '🍿 Maratón',
  'Sin Clichés': '🦄 Original',
  'Confusa': '🌀 Confusa',
  'Mal Final': '📉 Final',
  'Lenta/Sin Rumbo': '🐌 Lenta',
  'Decepcionante': '👎 Decepción',
  'Pjs Planos': '🙄 Planos',
  'Mucho Relleno': '🧀 Relleno',
  'Inconsistencias': '🤨 Inconsist.',
  'Costó Terminarlo': '😮‍💪 Costó',
};

function getShortLabel(label: string): string {
  // Try exact match first
  if (SHORT_LABELS[label]) return SHORT_LABELS[label];
  // Try case-insensitive match
  const lower = label.toLowerCase();
  for (const [key, val] of Object.entries(SHORT_LABELS)) {
    if (key.toLowerCase() === lower) return val;
  }
  // Fallback: truncate
  return label.length > 12 ? label.slice(0, 11) + '…' : label;
}

export const EmotionalRadar: React.FC<EmotionalRadarProps> = ({ stats }) => {
  const [hoveredAxis, setHoveredAxis] = useState<string | null>(null);

  // Get top emotions sorted by time
  const emotions = useMemo(() => {
    const entries = Object.entries(stats.emotionConsumption)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_AXES);
    return entries;
  }, [stats.emotionConsumption]);

  if (emotions.length < 3) {
    return (
      <div className="bg-[#111113] ring-1 ring-white/[0.06] p-1 rounded-2xl shadow-lg">
        <div className="bg-[#18181B] rounded-[calc(1rem-0.25rem)] p-6 text-center">
          <Crosshair className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-zinc-400">Necesitás al menos 3 emociones</p>
          <p className="text-xs text-zinc-600 mt-1">Agregá tags emocionales a tus obras para ver tu perfil.</p>
        </div>
      </div>
    );
  }

  const maxTime = Math.max(...emotions.map(([, time]) => time));
  const n = emotions.length;

  // SVG dimensions
  const size = 280;
  const center = size / 2;
  const radius = 100;
  const levels = 4; // concentric rings

  // Calculate polygon points
  const getPoint = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / n - Math.PI / 2;
    const r = (value / maxTime) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  // Grid rings
  const gridRings = Array.from({ length: levels }, (_, i) => {
    const r = ((i + 1) / levels) * radius;
    const points = Array.from({ length: n }, (_, j) => {
      const angle = (Math.PI * 2 * j) / n - Math.PI / 2;
      return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
    }).join(' ');
    return points;
  });

  // Axis lines
  const axisLines = emotions.map((_, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return {
      x2: center + radius * Math.cos(angle),
      y2: center + radius * Math.sin(angle),
    };
  });

  // Data polygon
  const dataPoints = emotions.map(([, time], i) => getPoint(i, time));
  const polygonPoints = dataPoints.map(p => `${p.x},${p.y}`).join(' ');

  // Label positions (slightly outside the radius)
  const labelPositions = emotions.map(([label], i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const labelRadius = radius + 28;
    return {
      label: getShortLabel(label),
      fullLabel: label,
      x: center + labelRadius * Math.cos(angle),
      y: center + labelRadius * Math.sin(angle),
      time: emotions[i][1],
    };
  });

  // Value points (dots on the polygon)
  const dotPoints = dataPoints.map((p, i) => ({
    ...p,
    label: emotions[i][0],
    time: emotions[i][1],
  }));

  return (
    <div className="bg-[#111113] ring-1 ring-white/[0.06] p-1 rounded-2xl shadow-lg overflow-hidden">
      <div
        className="bg-[#18181B] rounded-[calc(1rem-0.25rem)] p-4 md:p-6"
        style={{ borderTop: `1px solid ${RADAR_COLOR}30` }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <Crosshair
            className="w-4 h-4"
            style={{ color: RADAR_COLOR, filter: `drop-shadow(0 0 6px ${RADAR_COLOR})` }}
          />
          <span className="text-xs font-extrabold uppercase text-zinc-400" style={{ letterSpacing: '0.1em' }}>
            Perfil Emocional
          </span>
        </div>

        {/* Radar Chart */}
        <div className="flex justify-center">
          <svg
            viewBox={`0 0 ${size} ${size}`}
            className="w-full max-w-[300px] md:max-w-[350px]"
          >
            {/* Grid rings */}
            {gridRings.map((points, i) => (
              <polygon
                key={i}
                points={points}
                fill="none"
                stroke={GRID_COLOR}
                strokeWidth="1"
              />
            ))}

            {/* Axis lines */}
            {axisLines.map((line, i) => (
              <line
                key={i}
                x1={center}
                y1={center}
                x2={line.x2}
                y2={line.y2}
                stroke={GRID_COLOR}
                strokeWidth="1"
              />
            ))}

            {/* Data polygon - fill */}
            <polygon
              points={polygonPoints}
              fill={RADAR_BG}
              stroke={RADAR_COLOR}
              strokeWidth="2"
              className="transition-all duration-300"
              style={{
                filter: hoveredAxis
                  ? 'drop-shadow(0 0 8px rgba(167, 139, 250, 0.4))'
                  : 'drop-shadow(0 0 4px rgba(167, 139, 250, 0.2))',
              }}
            />

            {/* Data points (dots) */}
            {dotPoints.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={hoveredAxis === p.label ? 6 : 4}
                fill={RADAR_COLOR}
                stroke="#18181B"
                strokeWidth="2"
                className="transition-all duration-200 cursor-pointer"
                onMouseEnter={() => setHoveredAxis(p.label)}
                onMouseLeave={() => setHoveredAxis(null)}
                style={{
                  filter: hoveredAxis === p.label
                    ? `drop-shadow(0 0 8px ${RADAR_COLOR})`
                    : 'none',
                }}
              />
            ))}

            {/* Center dot */}
            <circle cx={center} cy={center} r="3" fill={RADAR_COLOR} opacity="0.5" />

            {/* Labels */}
            {labelPositions.map((lp, i) => {
              const isHovered = hoveredAxis === lp.fullLabel;
              return (
                <g key={i}>
                  <text
                    x={lp.x}
                    y={lp.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="text-[10px] md:text-xs font-bold pointer-events-none select-none"
                    fill={isHovered ? '#ffffff' : LABEL_COLOR}
                    style={{
                      filter: isHovered ? `drop-shadow(0 0 4px ${RADAR_COLOR})` : 'none',
                      transition: 'all 0.2s',
                    }}
                  >
                    {lp.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Hovered stat */}
        {hoveredAxis && (
          <div className="mt-4 text-center animate-fade-in">
            <p className="text-sm font-bold text-white">
              {hoveredAxis}
            </p>
            <p className="text-xs text-zinc-400 font-mono">
              {(emotions.find(([l]) => l === hoveredAxis)?.[1] ?? 0).toFixed(0)} minutos invertidos
            </p>
          </div>
        )}

        {/* Legend (bottom) */}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {emotions.map(([label, time], i) => {
            const percent = maxTime > 0 ? (time / maxTime) * 100 : 0;
            return (
              <div
                key={label}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium transition-all cursor-default ${
                  hoveredAxis === label
                    ? 'bg-white/10 text-white ring-1 ring-white/20'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
                onMouseEnter={() => setHoveredAxis(label)}
                onMouseLeave={() => setHoveredAxis(null)}
              >
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: RADAR_COLOR,
                    opacity: 0.3 + (percent / 100) * 0.7,
                  }}
                />
                <span className="truncate max-w-[80px]">{getShortLabel(label)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
