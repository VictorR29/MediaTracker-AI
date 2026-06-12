import React, { useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { MediaItem } from '../types';
import { useLibraryStore } from '../stores/useLibraryStore';
import { useAuthStore } from '../stores/useAuthStore';
import { MediaCard } from './MediaCard';

interface ItemDetailViewProps {
  onUpdateItem: (item: MediaItem) => void;
  onRequestDelete: (item: MediaItem) => void;
}

export const ItemDetailView: React.FC<ItemDetailViewProps> = ({ onUpdateItem, onRequestDelete }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const library = useLibraryStore(s => s.library);
  const userProfile = useAuthStore(s => s.userProfile);

  // Look up the item from library by route param
  const item = useMemo(() => library.find(i => i.id === id) || null, [library, id]);

  // Determine back label based on where we came from
  const backLabel = location.state?.from === 'wishlist' ? 'Deseos' : 'la biblioteca';

  if (!item) {
    return (
      <div className="animate-fade-in text-center py-20 text-zinc-500">
        <p>Obra no encontrada</p>
        <button
          onClick={() => navigate('/')}
          className="mt-4 px-6 py-3 bg-white hover:bg-zinc-200 text-zinc-900 font-bold rounded-xl transition-all"
        >
          Volver a la biblioteca
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 flex items-center gap-2 text-zinc-400 hover:text-white transition-colors font-medium"
      >
        ← Volver a {backLabel}
      </button>
      <MediaCard
        item={item}
        onUpdate={onUpdateItem}
        onDelete={() => onRequestDelete(item)}
        username={userProfile?.username}
        apiKey={userProfile?.apiKey}
        isNew={!item.aiData.title}
      />
    </div>
  );
};
