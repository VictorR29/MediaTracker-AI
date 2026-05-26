import React from 'react';
import { AIWorkData, UserTrackingData } from '../../types';
import {
  Edit3, X, Trash2, Star, Link as LinkIcon,
  Plus, Layout, Globe, Upload, Image as ImageIcon,
} from 'lucide-react';
import { extractColorFromImage } from './colorUtils';

interface IdentityColumnProps {
  aiData: AIWorkData;
  trackingData: UserTrackingData;
  isEditing: boolean;
  isDragging: boolean;
  dynamicColor: string;
  dynamicRgb: string;
  onAIDataChange: (field: keyof AIWorkData, value: any) => void;
  onInputChange: (field: keyof UserTrackingData, value: any, shouldSave?: boolean) => void;
  onImageDrop: (e: React.DragEvent) => void;
  onImageClick: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveGenre: (genre: string) => void;
  onAddGenre: () => void;
  onRemoveCustomLink: (id: string) => void;
  onAddCustomLink: () => void;
  onToggleFavorite: () => void;
  onDelete?: () => void;
  onToggleEdit: () => void;
  newGenreInput: string;
  setNewGenreInput: (val: string) => void;
  newLinkUrl: string;
  setNewLinkUrl: (val: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

const IdentityColumnInner: React.FC<IdentityColumnProps> = ({
  aiData, trackingData: tracking, isEditing, isDragging, dynamicColor, dynamicRgb,
  onAIDataChange, onInputChange, onImageDrop, onImageClick, onFileChange,
  onRemoveGenre, onAddGenre, onRemoveCustomLink, onAddCustomLink,
  onToggleFavorite, onDelete, onToggleEdit,
  newGenreInput, setNewGenreInput, newLinkUrl, setNewLinkUrl, fileInputRef,
}) => {
  return (
    <div className="flex flex-col gap-6 xl:gap-8">
      {/* Poster with Interactive Upload */}
      <div className="flex flex-col gap-3">
        <div
          className={`relative rounded-2xl overflow-hidden shadow-2xl aspect-[2/3] bg-zinc-900 group transition-all duration-300 ${isEditing ? 'cursor-pointer' : ''} ${isDragging ? 'ring-4 ring-[rgb(var(--card-rgb))] scale-[1.02]' : ''}`}
          onClick={onImageClick}
          onDragOver={(e) => { e.preventDefault(); }}
          onDragLeave={(e) => { e.preventDefault(); }}
          onDrop={onImageDrop}
          style={{
            border: isEditing ? `2px dashed ${isDragging ? dynamicColor : '#475569'}` : `1px solid ${dynamicColor}40`,
            boxShadow: isEditing ? 'none' : `0 20px 40px -10px ${dynamicColor}40`
          }}
        >
          {aiData.coverImage ? (
            <img src={aiData.coverImage} alt={aiData.title} className="w-full h-full object-cover transition-opacity pointer-events-none" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-zinc-700 p-4 text-center">
              <ImageIcon className="w-16 h-16 mb-2 opacity-50" />
              <span className="text-xs font-medium opacity-50">Sin Imagen</span>
            </div>
          )}

          {/* Overlay for editing image visual cue */}
          {isEditing && (
            <div className={`absolute inset-0 bg-black/60 flex flex-col items-center justify-center transition-opacity ${isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
              <Upload className="w-8 h-8 text-white mb-2" />
              <span className="text-white text-xs font-bold px-3 py-1 rounded-full border border-white/20 backdrop-blur-sm text-center">
                {isDragging ? 'Suelta la imagen aquí' : 'Click o Arrastra para cambiar'}
              </span>
            </div>
          )}
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={onFileChange}
          />
        </div>
        {isEditing && (
          <div>
            <label className="text-[10px] uppercase font-bold text-zinc-500 mb-1 block">URL de Portada (Opcional)</label>
            <input
              value={aiData.coverImage || ''}
              onChange={(e) => {
                onAIDataChange('coverImage', e.target.value);
                if (e.target.value.startsWith('http')) extractColorFromImage(e.target.value).then(c => onAIDataChange('primaryColor', c));
              }}
              className="w-full bg-zinc-900 ring-1 ring-white/[0.06] rounded-lg px-3 py-2 text-xs text-zinc-300 outline-none focus:ring-white/20"
              placeholder="https://..."
            />
          </div>
        )}
      </div>

      {/* Title Block */}
      <div>
        {isEditing ? (
          <div className="space-y-3 mb-4">
            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-500 mb-1 block">Título Principal</label>
              <input
                value={aiData.title}
                onChange={(e) => onAIDataChange('title', e.target.value)}
                className="w-full bg-zinc-900 ring-1 ring-white/[0.06] rounded-lg p-3 text-lg font-bold text-white outline-none focus:ring-white/20"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-500 mb-1 block">Título Original</label>
              <input
                value={aiData.originalTitle || ''}
                onChange={(e) => onAIDataChange('originalTitle', e.target.value)}
                className="w-full bg-zinc-900 ring-1 ring-white/[0.06] rounded-lg p-2 text-sm text-zinc-400 italic outline-none focus:ring-white/20"
                placeholder="Ej: Kimetsu no Yaiba"
              />
            </div>
          </div>
        ) : (
          <>
            <h1 className="text-2xl xl:text-3xl font-black text-white leading-tight mb-2">{aiData.title}</h1>
            {aiData.originalTitle && <p className="text-sm text-zinc-500 italic mb-4">{aiData.originalTitle}</p>}
          </>
        )}

        <div className="flex flex-wrap gap-2 mb-6 xl:mb-8">
<span className="px-3 xl:px-4 py-1.5 bg-zinc-800/80 ring-1 ring-white/[0.06] rounded text-[10px] xl:text-xs font-bold text-zinc-400 uppercase">{aiData.mediaType}</span>
      <span className="px-3 xl:px-4 py-1.5 bg-zinc-800/80 ring-1 ring-white/[0.06] rounded text-[10px] xl:text-xs font-bold text-zinc-400 uppercase">{aiData.status}</span>
          {!isEditing && (
            <button onClick={onToggleEdit} className="p-1.5 text-zinc-500 hover:text-white transition-colors" title="Editar detalles">
              <Edit3 className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="flex gap-2 xl:gap-3 mb-8 xl:mb-10">
          <button
            onClick={onToggleFavorite}
            className={`flex-1 py-3 xl:py-4 rounded-full font-bold text-xs xl:text-sm flex items-center justify-center gap-2 ring-1 transition-all active:scale-[0.97] ${tracking.is_favorite ? 'bg-yellow-500/10 ring-yellow-500/50 text-yellow-500' : 'bg-zinc-800 ring-white/[0.06] text-zinc-400'}`}
          >
            <Star className={`w-4 h-4 xl:w-5 xl:h-5 ${tracking.is_favorite ? 'fill-current' : ''}`} /> FAVORITO
          </button>
          {onDelete && (
            <button onClick={onDelete} className="p-3 xl:p-4 bg-red-900/10 hover:bg-red-900/20 text-red-500 ring-1 ring-red-900/30 rounded-full transition-colors">
              <Trash2 className="w-5 h-5 xl:w-6 xl:h-6" />
            </button>
          )}
        </div>
      </div>

      {/* Metadata Details */}
      <div className="space-y-5 xl:space-y-6 text-sm ring-1 ring-white/[0.06] rounded-2xl p-4 xl:p-6 pt-6 xl:pt-8">
        <div className="flex flex-col gap-2">
          <span className="text-zinc-500 font-bold uppercase tracking-widest text-[10px] xl:text-xs">Fechas</span>
          <div className="flex justify-between items-center text-zinc-300 text-xs xl:text-sm">
            <span className="font-medium">Estreno:</span>
            {isEditing ? (
              <input
                type="date"
                value={aiData.releaseDate || ''}
                onChange={(e) => onAIDataChange('releaseDate', e.target.value)}
                className="bg-zinc-900 ring-1 ring-white/[0.06] rounded px-2 py-1 text-xs text-white outline-none focus:ring-white/20 w-32"
              />
            ) : (
              <span className="font-mono">{aiData.releaseDate || '----'}</span>
            )}
          </div>
          <div className="flex justify-between items-center text-zinc-300 text-xs xl:text-sm">
            <span className="font-medium">Final:</span>
            {isEditing ? (
              <input
                type="date"
                value={aiData.endDate || ''}
                onChange={(e) => onAIDataChange('endDate', e.target.value)}
                className="bg-zinc-900 ring-1 ring-white/[0.06] rounded px-2 py-1 text-xs text-white outline-none focus:ring-white/20 w-32"
              />
            ) : (
              <span className="font-mono">{aiData.endDate || '----'}</span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <span className="text-zinc-500 font-bold uppercase tracking-widest text-[10px] xl:text-xs">Géneros</span>
          <div className="flex flex-wrap gap-2">
            {(aiData.genres || []).map(g => (
              <span key={g} className="px-2.5 py-1 bg-zinc-800 ring-1 ring-white/[0.06] rounded-lg text-zinc-300 text-xs flex items-center gap-1.5">
                {g}
                {isEditing && (
                  <button onClick={() => onRemoveGenre(g)} className="text-zinc-500 hover:text-red-400">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
          {isEditing && (
            <div className="flex gap-2">
              <input
                value={newGenreInput}
                onChange={(e) => setNewGenreInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onAddGenre()}
                placeholder="Añadir género..."
                className="flex-1 bg-zinc-900 ring-1 ring-white/[0.06] rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:ring-white/20"
              />
              <button onClick={onAddGenre} className="bg-zinc-800 hover:bg-[rgb(var(--card-rgb))] p-1.5 rounded-lg ring-1 ring-white/[0.06] text-white transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <span className="text-zinc-500 font-bold uppercase tracking-widest text-[10px] xl:text-xs flex items-center gap-2"><Layout className="w-3 h-3 xl:w-4 xl:h-4" /> Estructura</span>
          {isEditing ? (
            <textarea
              value={aiData.totalContent || ''}
              onChange={(e) => onAIDataChange('totalContent', e.target.value)}
              className="bg-zinc-900 ring-1 ring-white/[0.06] rounded-2xl p-3 text-xs text-white outline-none focus:ring-white/20 min-h-[100px]"
              placeholder={"Ej: 2 Temporadas\n- Temp 1: 12 Caps"}
            />
          ) : (
            <div className="bg-zinc-900/80 rounded-2xl p-4 ring-1 ring-white/[0.06] shadow-inner">
              <pre className="whitespace-pre-wrap font-sans text-zinc-300 leading-relaxed text-xs xl:text-sm">{aiData.totalContent || 'No definida'}</pre>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <span className="text-zinc-500 font-bold uppercase tracking-widest text-[10px] xl:text-xs flex items-center gap-2"><Globe className="w-3 h-3 xl:w-4 xl:h-4 text-[rgb(var(--card-rgb))]" /> Mis Enlaces & Seguimiento</span>
          <div className="flex flex-col gap-2">
            {tracking.customLinks && tracking.customLinks.map((link) => (
              <div key={link.id} className="flex items-center justify-between group bg-zinc-900/50 p-2 rounded-xl ring-1 ring-white/[0.06]">
                <a href={link.url} target="_blank" rel="noreferrer" className="text-[rgb(var(--card-rgb))] hover:text-white truncate flex items-center gap-3 flex-1 text-xs xl:text-sm">
                  <LinkIcon className="w-3 h-3 opacity-50" /> {link.title || 'Enlace'}
                </a>
                <button onClick={() => onRemoveCustomLink(link.id)} className="p-1.5 text-zinc-600 hover:text-red-500 transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <div className="flex gap-2 mt-2">
              <input
                placeholder="Pegar URL..."
                value={newLinkUrl}
                onChange={(e) => setNewLinkUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onAddCustomLink()}
                className="flex-1 bg-zinc-900 ring-1 ring-white/[0.06] rounded-xl px-3 py-2 text-white text-xs outline-none focus:ring-white/20"
              />
              <button onClick={onAddCustomLink} className="bg-zinc-800 hover:bg-[rgb(var(--card-rgb))] p-2 rounded-xl ring-1 ring-white/[0.06] text-white transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    );
};

export const IdentityColumn = React.memo(IdentityColumnInner);
