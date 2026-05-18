import React from 'react';

export interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: { bg: string; text: string };
  subtext?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, color, subtext }) => (
  <div className="bg-surface border border-zinc-700 p-4 md:p-6 rounded-2xl flex items-center justify-between hover:border-zinc-500 transition-colors shadow-md min-w-0 overflow-hidden">
    <div className="min-w-0 flex-1 mr-3 overflow-hidden">
      <p className="text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1 truncate">{title}</p>
      <p className="text-2xl md:text-3xl font-bold text-white mb-1 truncate" title={String(value)}>{value}</p>
      {subtext && <p className="text-xs text-zinc-500 truncate">{subtext}</p>}
    </div>
    <div className={`p-3 md:p-4 rounded-xl bg-opacity-10 ${color.bg} shadow-inner flex-shrink-0`}>
      <Icon className={`w-6 h-6 md:w-8 md:h-8 ${color.text}`} />
    </div>
  </div>
);
