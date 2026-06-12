import React, { useState, useMemo, useCallback } from 'react';
import { Crosshair } from 'lucide-react';
import { StatsData } from './StatsData';

interface EmotionalRadarProps {
  stats: StatsData;
}

// How many emotion axes to show (max)
const MAX_AXES = 6;

// Colors for the radar
const RADAR_COLOR = '#a78bfa'; // violet
const RADAR_BG = 'rgba(167, 139, 250, 0.15)';
const GRID_COLOR = 'rgba(255, 255, 255, 0.06)';
const LABEL_COLOR = 'rgba(255, 255, 255, 0.7)';

// Short labels for display (maps long emotion names to short forms)
const SHORT_LABELS: Record<string, string> = {
  'Corazón Roto': '💔 Roto',
  'Perfecto': '✨ Perfecto',
  'Entrañables': '🫂 Entrañ.',
  'Adictivo': '💉 Adictivo',
  'Arte Increíble': '🎨 Arte',
  'Soundtrack': '🎵 Sound',
  'Mucha Risa': '🤣 Risa',
  'Miedo/Ansiedad': '😨 Miedo',
  'Giro Impactante': '🤯 Giro',
  'Ritmo Impecable': '⚡ Ritmo',
  'Mundo Épico': '🌍 Mundo',
  'Reflexivo': '🤔 Reflex.',
  'Desafiante': '🧩 Desafío',
  'Adrenalina': '🔥 Adrenal.',
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
  return label.length > 10 ? label.slice(0, 9) + '…' : label;
}

export const EmotionalRadar: React.FC<EmotionalRadarProps> = ({ stats }) => {
  const [hoveredAxis, setHoveredAxis] = useState<string | null>(null);

  // Toggle for mobile (tap to select, tap again to deselect)
  const handleDotClick = useCallback((label: string) => {
    setHoveredAxis(prev => prev === label ? null : label);
  }, []);

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
    const labelRadius = radius + 36;
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

        {/* Radar Chart + Stats — two columns on desktop, stacked on mobile */}
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-8">
          {/* Left: Radar SVG */}
          <div className="flex justify-center flex-shrink-0">
            <svg
              viewBox={`0 0 ${size} ${size}`}
              className="w-full max-w-[280px] md:max-w-[320px]"
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

              {/* Data points (dots) — clickable for mobile */}
              {dotPoints.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={hoveredAxis === p.label ? 7 : 5}
                  fill={RADAR_COLOR}
                  stroke="#18181B"
                  strokeWidth="2"
                  className="transition-all duration-200 cursor-pointer"
                  onMouseEnter={() => setHoveredAxis(p.label)}
                  onMouseLeave={() => setHoveredAxis(null)}
                  onClick={() => handleDotClick(p.label)}
                  style={{
                    filter: hoveredAxis === p.label
                      ? `drop-shadow(0 0 10px ${RADAR_COLOR})`
                      : 'none',
                  }}
                />
              ))}

              {/* Center dot */}
              <circle cx={center} cy={center} r="3" fill={RADAR_COLOR} opacity="0.5" />
            </svg>
          </div>

          {/* Right: Legend + Stats */}
          <div className="flex-1 w-full min-w-0">
            {/* Legend — interactive grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {emotions.map(([label, time], i) => {
                const percent = maxTime > 0 ? (time / maxTime) * 100 : 0;
                const isActive = hoveredAxis === label;
                return (
                  <button
                    key={label}
                    onClick={() => handleDotClick(label)}
                    onMouseEnter={() => setHoveredAxis(label)}
                    onMouseLeave={() => setHoveredAxis(null)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl text-left transition-all duration-200 ${
                      isActive
                        ? 'bg-white/10 ring-1 ring-white/20 text-white translate-x-1'
                        : 'bg-white/[0.02] hover:bg-white/[0.06] text-zinc-400 hover:text-zinc-200 ring-1 ring-transparent'
                    }`}
                  >
                    <div
                      className={`w-3 h-3 rounded-full flex-shrink-0 transition-all duration-200 ${isActive ? 'scale-125 ring-2 ring-white/30' : ''}`}
                      style={{ backgroundColor: RADAR_COLOR, opacity: 0.3 + (percent / 100) * 0.7 }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-bold truncate ${isActive ? 'text-white' : ''}`}>
                        {getShortLabel(label)}
                      </p>
                      <p className="text-[10px] text-zinc-500 font-mono">
                        {time.toFixed(0)}min
                      </p>
                    </div>
                    {/* Bar indicator */}
                    <div className="w-12 h-1.5 bg-white/5 rounded-full overflow-hidden flex-shrink-0 hidden sm:block">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${percent}%`,
                          backgroundColor: RADAR_COLOR,
                          opacity: isActive ? 1 : 0.5,
                        }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Hovered stat detail */}
            {hoveredAxis && (
              <div className="mt-4 p-3 bg-white/[0.03] rounded-xl ring-1 ring-white/[0.06] text-center animate-fade-in">
                <p className="text-base font-bold text-white">{hoveredAxis}</p>
                <p className="text-xs text-zinc-400 font-mono mt-1">
                  {(emotions.find(([l]) => l === hoveredAxis)?.[1] ?? 0).toFixed(0)} minutos invertidos
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
