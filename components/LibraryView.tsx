import React, { useMemo } from 'react';
import { Search as SearchIcon } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useLibraryStore } from '../stores/useLibraryStore';
import { useUIStore } from '../stores/useUIStore';
import { useAuthStore } from '../stores/useAuthStore';
import { ContextualGreeting } from './ContextualGreeting';
import { LibraryFilters } from './LibraryFilters';
import { CompactMediaCard } from './CompactMediaCard';
import { CatalogView } from './CatalogView';
import { MediaItem } from '../types';

interface LibraryViewProps {
  onOpenDetail: (item: MediaItem) => void;
  onIncrementProgress: (item: MediaItem) => void;
  onToggleFavorite: (item: MediaItem) => void;
  onRequestDelete: (item: MediaItem) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  onOpenDetail,
  onIncrementProgress,
  onToggleFavorite,
  onRequestDelete,
}) => {
  const location = useLocation();
  const view = location.pathname === '/wishlist' ? 'upcoming' : 'library';

  const userProfile = useAuthStore(s => s.userProfile);
  const { library, filters, setFilters, getDisplayedLibrary, getAvailableGenres } = useLibraryStore();
  const { libraryViewMode, toggleLibraryViewMode } = useUIStore();

  const displayedLibrary = useMemo(() => getDisplayedLibrary(view), [library, filters, view, getDisplayedLibrary]);
  const availableGenres = useMemo(() => getAvailableGenres(), [library, getAvailableGenres]);

  return (
    <div>
      <ContextualGreeting userProfile={userProfile!} library={library} view={view} />

      <LibraryFilters
        filters={filters}
        onChange={setFilters}
        availableGenres={availableGenres}
        viewMode={libraryViewMode}
        onToggleViewMode={toggleLibraryViewMode}
      />

      {libraryViewMode === 'catalog' && view === 'library' ? (
        <CatalogView
          library={displayedLibrary}
          onOpenDetail={onOpenDetail}
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
          {displayedLibrary.map(item => (
            <CompactMediaCard
              key={item.id}
              item={item}
              onClick={onOpenDetail}
              onIncrement={onIncrementProgress}
              onToggleFavorite={onToggleFavorite}
              onDelete={onRequestDelete}
            />
          ))}
          {displayedLibrary.length === 0 && (
            <div className="col-span-full text-center py-20 text-zinc-500 flex flex-col items-center">
              <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mb-4 border border-zinc-800">
                <SearchIcon className="w-8 h-8 opacity-20" />
              </div>
              <p>No se encontraron obras</p>
              {view === 'upcoming' && <p className="text-sm mt-1">Añade obras a "Planeado" para verlas aquí.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
