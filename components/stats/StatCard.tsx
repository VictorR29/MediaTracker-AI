import React from 'react';

export interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: { bg: string; text: string };
  subtext?: string;
  accentColor: string;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, color, subtext, accentColor }) => (
  <div className="bg-[#111113] ring-1 ring-white/[0.06] p-1 rounded-2xl transition-all duration-150 min-w-0 overflow-hidden active:scale-[0.97]" style={{ transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)' }}>
    <div
      className="bg-[#18181B] rounded-[calc(1rem-0.25rem)] p-4 md:p-5 flex items-center justify-between min-w-0 overflow-hidden"
      style={{
        borderTop: `1px solid ${accentColor}40`,
        boxShadow: `inset 0 1px 0 ${accentColor}20, 0 0 30px -10px ${accentColor}30`
      }}
    >
      <div className="min-w-0 flex-1 mr-3 overflow-hidden">
        <p
          className="text-zinc-400 text-[10px] font-extrabold uppercase mb-1 truncate"
          style={{ letterSpacing: '0.1em', textShadow: `0 0 12px ${accentColor}30` }}
        >
          {title}
        </p>
        <p
          className="text-2xl md:text-3xl font-bold text-white font-mono mb-1 truncate"
          style={{ letterSpacing: '0.02em', textShadow: `0 0 20px ${accentColor}40` }}
          title={String(value)}
        >
          {value}
        </p>
        {subtext && (
          <p className="text-xs text-zinc-500 font-mono truncate" style={{ letterSpacing: '0.02em' }}>
            {subtext}
          </p>
        )}
      </div>
      <div
        className={`p-3 md:p-4 rounded-xl ${color.bg}/10 ring-1 ring-white/[0.06] flex-shrink-0`}
        style={{ boxShadow: `0 0 20px ${accentColor}50` }}
      >
        <Icon className={`w-6 h-6 md:w-8 md:h-8 ${color.text}`} style={{ filter: `drop-shadow(0 0 6px ${accentColor})` }} />
      </div>
    </div>
  </div>
);
