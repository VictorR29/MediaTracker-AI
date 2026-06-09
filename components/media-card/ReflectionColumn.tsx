import React from 'react';
import { AIWorkData, UserTrackingData, EMOTIONAL_TAGS_OPTIONS, RATING_OPTIONS } from '../../types';
import { Wand2, RefreshCw, MessageSquare, Star, FileText } from 'lucide-react';

interface ReflectionColumnProps {
  aiData: AIWorkData;
  trackingData: UserTrackingData;
  isEditing: boolean;
  dynamicColor: string;
  dynamicRgb: string;
  onInputChange: (field: keyof UserTrackingData, value: any, shouldSave?: boolean) => void;
  onAIDataChange: (field: keyof AIWorkData, value: any) => void;
  onGenerateReview: () => void;
  isGeneratingReview: boolean;
  onUpdate: (item: any) => void;
  localData: any;
}

const ReflectionColumnInner: React.FC<ReflectionColumnProps> = ({
  aiData, trackingData: tracking, isEditing, dynamicColor, dynamicRgb,
  onInputChange, onAIDataChange, onGenerateReview, isGeneratingReview,
  onUpdate, localData,
}) => {
  return (
    <div className="flex flex-col gap-6 xl:gap-8">
      {/* Rating Grid */}
      <div className="bg-zinc-900/40 rounded-2xl p-6 border border-zinc-800/60 flex flex-col shadow-xl" style={{ borderTop: `1px solid rgba(${dynamicRgb}, 0.15)`, boxShadow: `inset 0 1px 0 rgba(${dynamicRgb}, 0.08), 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)` }}>
      <div className="flex flex-wrap gap-2 mb-6 xl:mb-8">
        {RATING_OPTIONS.map((opt) => {
          const isSelected = tracking.rating === opt;
          const label = opt.split(' ')[0];
          return (
            <button
              key={opt}
              onClick={() => onInputChange('rating', opt)}
              className={`flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-full border text-xs font-bold transition-all ${isSelected ? 'bg-[rgb(var(--card-rgb)/0.15)] border-[rgb(var(--card-rgb)/0.6)] text-[rgb(var(--card-rgb))] shadow-[0_0_12px_rgba(var(--card-rgb),0.15)]' : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}`}
            >
              <Star className={`w-3 h-3 ${isSelected ? 'fill-current' : ''}`} />
              <span className="uppercase tracking-wide">{label}</span>
            </button>
          );
        })}
        </div>
        <button
          onClick={onGenerateReview}
          disabled={isGeneratingReview}
          className={`w-full py-3 xl:py-4 hover:opacity-90 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 xl:gap-3 shadow-xl transition-all uppercase tracking-[0.2em] ${isGeneratingReview ? 'opacity-80 cursor-wait' : ''}`}
          style={{ backgroundColor: `rgb(var(--card-rgb))`, boxShadow: `0 10px 15px -3px rgba(var(--card-rgb), 0.25)` }}
        >
          {isGeneratingReview ? (
            <>
              <RefreshCw className="w-4 h-4 xl:w-5 xl:h-5 animate-spin" /> GENERANDO...
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4 xl:w-5 xl:h-5" /> CREAR RESEÑA CON IA
            </>
          )}
        </button>
      </div>

  {/* Reflection */}
  <div className="bg-zinc-900/40 rounded-2xl p-6 xl:p-8 border border-zinc-800/60 shadow-xl flex flex-col" style={{ borderTop: `1px solid rgba(${dynamicRgb}, 0.15)`, boxShadow: `inset 0 1px 0 rgba(${dynamicRgb}, 0.08), 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)` }}>
    <h3 className="text-sm xl:text-base font-bold text-white mb-6 xl:mb-8 flex items-center gap-3" style={{ textShadow: `0 0 15px rgba(${dynamicRgb}, 0.20)` }}>
      <MessageSquare className="w-4 h-4 xl:w-5 xl:h-5 text-zinc-400" /> Reflexión
    </h3>

    <div className="mb-6 xl:mb-8">
          <span className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 xl:mb-3">Recomendado por</span>
          <input
            value={tracking.recommendedBy || ''}
            onChange={(e) => onInputChange('recommendedBy', e.target.value, false)}
            onBlur={() => !isEditing && onUpdate(localData)}
            placeholder="Ej: Laura, r/anime..."
            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl px-4 py-2.5 xl:px-5 xl:py-3 text-sm text-zinc-300 outline-none focus:border-[rgb(var(--card-rgb))]"
          />
        </div>

    <div>
      <span className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 xl:mb-4">Resumen Emocional</span>
        {/* Emotional Tags — flex-wrap pills mobile, grid desktop */}
        <div className="flex flex-wrap gap-2 xl:grid xl:grid-cols-3 xl:gap-2.5">
          {EMOTIONAL_TAGS_OPTIONS.map(tag => {
            const isActive = (tracking.emotionalTags || []).includes(tag.label);
            return (
              <button
                key={tag.label}
                onClick={() => {
                  const currentTags = tracking.emotionalTags || [];
                  const newTags = isActive
                    ? currentTags.filter(t => t !== tag.label)
                    : [...currentTags, tag.label];
                  onInputChange('emotionalTags', newTags);
                }}
                className={`flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-full xl:rounded-2xl xl:gap-3 xl:px-4 xl:py-2.5 text-xs font-bold xl:font-black xl:uppercase xl:tracking-tight xl:text-left border transition-all ${isActive ? 'bg-[rgb(var(--card-rgb)/0.1)] border-[rgb(var(--card-rgb)/0.4)] text-[rgb(var(--card-rgb))] shadow-inner' : 'bg-zinc-950/50 border-zinc-800 text-zinc-500 hover:bg-zinc-800'}`}
              >
                <span className="text-sm">{tag.emoji}</span>
                <span>{tag.shortLabel}</span>
              </button>
            );
          })}
        </div>
        </div>
      </div>

  {/* Final Comment */}
  <div className="bg-zinc-900/40 rounded-2xl p-6 xl:p-8 border border-zinc-800/60 flex-1 flex flex-col shadow-xl" style={{ borderTop: `1px solid rgba(${dynamicRgb}, 0.15)`, boxShadow: `inset 0 1px 0 rgba(${dynamicRgb}, 0.08), 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)` }}>
    <h3 className="text-sm xl:text-base font-bold text-white mb-4 xl:mb-6 flex items-center gap-3" style={{ textShadow: `0 0 15px rgba(${dynamicRgb}, 0.20)` }}>
      <FileText className="w-4 h-4 xl:w-5 xl:h-5 text-zinc-400" /> Comentario Final
        </h3>
        <textarea
          value={tracking.comment}
          onChange={(e) => onInputChange('comment', e.target.value, false)}
          onBlur={() => !isEditing && onUpdate(localData)}
          placeholder="Tus pensamientos finales sobre esta experiencia..."
          className="w-full flex-1 bg-zinc-900/50 border border-zinc-800 rounded-3xl p-4 xl:p-5 text-sm text-zinc-300 outline-none focus:border-[rgb(var(--card-rgb))] resize-none leading-relaxed min-h-[120px] xl:min-h-[140px]"
        />
      </div>
      </div>
    );
};

export const ReflectionColumn = React.memo(ReflectionColumnInner);
