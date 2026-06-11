import React, { useMemo, useEffect, useRef } from 'react';
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
  // Stagger entrance trigger — increments on mount or filter/view change
  const [staggerTrigger, setStaggerTrigger] = React.useState(0);
  const location = useLocation();
  const view = location.pathname === '/wishlist' ? 'upcoming' : 'library';

  const userProfile = useAuthStore(s => s.userProfile);
  const { library, filters, setFilters, getDisplayedLibrary, getAvailableGenres } = useLibraryStore();
  const { libraryViewMode, toggleLibraryViewMode, libraryScrollY, setLibraryScrollY, lastOpenedItemId, setLastOpenedItemId } = useUIStore();

  // Restore scroll position on mount (returning from detail view)
  // Uses scrollIntoView on the previously opened card to be resilient
  // to contentVisibility: auto layout shifts
  useEffect(() => {
    if (lastOpenedItemId) {
      const itemId = lastOpenedItemId;
      setLastOpenedItemId(null);
      setLibraryScrollY(0);
      // Wait for the grid to render, then scroll to the card
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const cardEl = document.getElementById(`card-${itemId}`);
          if (cardEl) {
            cardEl.scrollIntoView({ block: 'center', behavior: 'instant' });
          } else if (libraryScrollY > 0) {
            window.scrollTo({ top: libraryScrollY, behavior: 'instant' });
          }
        });
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — intentionally run once on mount

  // Debounced scroll position save
  const scrollSaveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    const handleScroll = () => {
      clearTimeout(scrollSaveTimerRef.current);
      scrollSaveTimerRef.current = setTimeout(() => {
        setLibraryScrollY(window.scrollY);
      }, 300);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollSaveTimerRef.current);
    };
  }, [setLibraryScrollY]);

  const displayedLibrary = useMemo(() => getDisplayedLibrary(view), [library, filters, view, getDisplayedLibrary]);
  const availableGenres = useMemo(() => getAvailableGenres(), [library, getAvailableGenres]);

  // Trigger stagger re-entrance on filter/view change (mount is handled locally by each card)
  React.useEffect(() => {
    setStaggerTrigger(t => t + 1);
  }, [view, filters.searchQuery, filters.statusFilter, filters.genreFilter, filters.sortBy]);

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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6 stagger-children">
          {displayedLibrary.map((item, index) => (
            <CompactMediaCard
              key={item.id}
              id={`card-${item.id}`}
              item={item}
              onClick={onOpenDetail}
              onIncrement={onIncrementProgress}
              onToggleFavorite={onToggleFavorite}
              onDelete={onRequestDelete}
              staggerIndex={index}
              staggerTrigger={staggerTrigger}
              // Only first 8 cards get mount stagger; rest use IntersectionObserver
              useMountStagger={index < 8}
            />
          ))}
		{displayedLibrary.length === 0 && (
			<div className="col-span-full text-center py-20 text-zinc-500 flex flex-col items-center">
			<div className="w-16 h-16 bg-zinc-800/50 rounded-full flex items-center justify-center mb-4 ring-1 ring-white/[0.06]">
				<SearchIcon className="w-8 h-8 text-zinc-600" />
			</div>
			<p className="text-zinc-400 font-medium">No se encontraron obras</p>
			{view === 'upcoming' && <p className="text-sm mt-1 text-zinc-500">Añade obras a "Planeado" para verlas aquí.</p>}
			</div>
		)}
        </div>
      )}
    </div>
  );
};
