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

export const ReflectionColumn: React.FC<ReflectionColumnProps> = ({
  aiData, trackingData: tracking, isEditing, dynamicColor, dynamicRgb,
  onInputChange, onAIDataChange, onGenerateReview, isGeneratingReview,
  onUpdate, localData,
}) => {
  return (
    <div className="flex flex-col gap-6 xl:gap-8 pt-10 lg:pt-0">
      {/* Rating Grid */}
      <div className="bg-slate-900/40 rounded-[2.5rem] p-6 border border-slate-800 flex flex-col shadow-xl">
        <div className="grid grid-cols-4 gap-2 xl:gap-3 mb-6 xl:mb-8">
          {RATING_OPTIONS.map((opt) => {
            const isSelected = tracking.rating === opt;
            const label = opt.split(' ')[0];
            return (
              <button
                key={opt}
                onClick={() => onInputChange('rating', opt)}
                className={`flex flex-col items-center gap-1 xl:gap-2 p-2 xl:p-3 rounded-2xl border transition-all ${isSelected ? 'bg-[rgb(var(--card-rgb)/0.2)] border-[rgb(var(--card-rgb))] text-[rgb(var(--card-rgb))] shadow-lg' : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:bg-slate-800'}`}
              >
                <Star className={`w-3 h-3 xl:w-4 xl:h-4 ${isSelected ? 'fill-current' : ''}`} />
                <span className="text-[8px] xl:text-[9px] font-black uppercase tracking-tighter text-center">{label}</span>
              </button>
            );
          })}
        </div>
        <button
          onClick={onGenerateReview}
          disabled={isGeneratingReview}
          className={`w-full py-3 xl:py-4 hover:opacity-90 text-white rounded-2xl text-[10px] xl:text-xs font-black flex items-center justify-center gap-2 xl:gap-3 shadow-xl transition-all uppercase tracking-[0.2em] ${isGeneratingReview ? 'opacity-80 cursor-wait' : ''}`}
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
      <div className="bg-slate-900/40 rounded-[2.5rem] p-6 xl:p-8 border border-slate-800 shadow-xl flex flex-col min-h-0">
        <h3 className="text-sm xl:text-base font-bold text-white mb-6 xl:mb-8 flex items-center gap-3">
          <MessageSquare className="w-4 h-4 xl:w-5 xl:h-5 text-slate-400" /> Reflexión
        </h3>

        <div className="mb-6 xl:mb-8">
          <span className="block text-[10px] xl:text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 xl:mb-3">Recomendado por</span>
          <input
            value={tracking.recommendedBy || ''}
            onChange={(e) => onInputChange('recommendedBy', e.target.value, false)}
            onBlur={() => !isEditing && onUpdate(localData)}
            placeholder="Ej: Laura, r/anime..."
            className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl px-4 py-2.5 xl:px-5 xl:py-3 text-sm text-slate-300 outline-none focus:border-[rgb(var(--card-rgb))]"
          />
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <span className="block text-[10px] xl:text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 xl:mb-4">Resumen Emocional</span>
          {/* Emotional Tags WITH SCROLL */}
          <div className="flex-1 overflow-y-auto pr-3 custom-scrollbar space-y-2 xl:space-y-2.5 max-h-[300px] xl:max-h-[350px]">
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
                  className={`w-full flex items-center gap-2 xl:gap-3 px-3 py-2.5 xl:px-4 xl:py-3 rounded-2xl text-[10px] xl:text-[11px] font-black border transition-all text-left uppercase tracking-tight ${isActive ? 'bg-[rgb(var(--card-rgb)/0.1)] border-[rgb(var(--card-rgb)/0.4)] text-[rgb(var(--card-rgb))] shadow-inner' : 'bg-slate-950/50 border-slate-800 text-slate-500 hover:bg-slate-800'}`}
                >
                  <span className="text-xs xl:text-sm">{tag.emoji}</span>
                  <span className="truncate">{tag.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Final Comment */}
      <div className="bg-slate-900/40 rounded-[2.5rem] p-6 xl:p-8 border border-slate-800 flex-1 flex flex-col shadow-xl">
        <h3 className="text-sm xl:text-base font-bold text-white mb-4 xl:mb-6 flex items-center gap-3">
          <FileText className="w-4 h-4 xl:w-5 xl:h-5 text-slate-400" /> Comentario Final
        </h3>
        <textarea
          value={tracking.comment}
          onChange={(e) => onInputChange('comment', e.target.value, false)}
          onBlur={() => !isEditing && onUpdate(localData)}
          placeholder="Tus pensamientos finales sobre esta experiencia..."
          className="w-full flex-1 bg-slate-900/50 border border-slate-800 rounded-3xl p-4 xl:p-5 text-sm text-slate-300 outline-none focus:border-[rgb(var(--card-rgb))] resize-none leading-relaxed min-h-[120px] xl:min-h-[140px]"
        />
      </div>
    </div>
  );
};
