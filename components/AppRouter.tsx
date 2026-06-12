import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { useLibraryStore } from '../stores/useLibraryStore';
import { Onboarding } from './Onboarding';
import { LoginScreen } from './LoginScreen';
import { LoadingOverlay } from './LoadingOverlay';
import { MediaItem } from '../types';

const LibraryView = lazy(() => import('./LibraryView').then(m => ({ default: m.LibraryView })));
const SearchView = lazy(() => import('./SearchView').then(m => ({ default: m.SearchView })));
const ItemDetailView = lazy(() => import('./ItemDetailView').then(m => ({ default: m.ItemDetailView })));
const DiscoveryView = lazy(() => import('./DiscoveryView').then(m => ({ default: m.DiscoveryView })));
const StatsView = lazy(() => import('./StatsView').then(m => ({ default: m.StatsView })));

const RouteSuspense: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Suspense fallback={
    <div className="min-h-[100dvh] bg-zinc-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  }>
    {children}
  </Suspense>
);

interface AppRouterProps {
  onOpenDetail: (item: MediaItem) => void;
  onIncrementProgress: (item: MediaItem) => void;
  onToggleFavorite: (item: MediaItem) => void;
  onRequestDelete: (item: MediaItem) => void;
  pendingDeleteId?: string | null;
  onUpdateItem: (item: MediaItem) => void;
  onRecommendationSelect: (title: string, type: string) => void;
  onImportBackup: (file: File) => void;
  isRestoring: boolean;
  onToggleImmersive: (v: boolean) => void;
  onSearchingChange?: (isSearching: boolean) => void;
}

export const AppRouter: React.FC<AppRouterProps> = ({
  onOpenDetail,
  onIncrementProgress,
  onToggleFavorite,
  onRequestDelete,
  pendingDeleteId,
  onUpdateItem,
  onRecommendationSelect,
  onImportBackup,
  isRestoring,
  onToggleImmersive,
  onSearchingChange,
}) => {
  const { userProfile, isAuthenticated, loading, login, completeOnboarding } = useAuthStore();
  const library = useLibraryStore(s => s.library);
  const updateProfile = useAuthStore(s => s.updateProfile);

  if (loading) {
    return <div className="min-h-[100dvh] bg-zinc-950 flex items-center justify-center text-white">Cargando...</div>;
  }

  if (!userProfile) {
    return (
      <>
        <Onboarding onComplete={completeOnboarding} onImport={onImportBackup} />
        <LoadingOverlay isVisible={isRestoring} type="restore" />
      </>
    );
  }

  if (!isAuthenticated) {
    return (
      <LoginScreen
        onUnlock={login}
        username={userProfile.username}
        avatarUrl={userProfile.avatarUrl}
        accentColor={userProfile.accentColor}
        library={library}
      />
    );
  }

  return (
    <Routes>
      <Route path="/" element={
        <RouteSuspense>
          <LibraryView
            onOpenDetail={onOpenDetail}
            onIncrementProgress={onIncrementProgress}
            onToggleFavorite={onToggleFavorite}
            onRequestDelete={onRequestDelete}
            pendingDeleteId={pendingDeleteId}
          />
        </RouteSuspense>
      } />
      <Route path="/item/:id" element={
        <RouteSuspense>
          <ItemDetailView
            onUpdateItem={onUpdateItem}
            onRequestDelete={onRequestDelete}
          />
        </RouteSuspense>
      } />
      <Route path="/add" element={
        <RouteSuspense>
          <SearchView onOpenDetail={onOpenDetail} onSearchingChange={onSearchingChange} />
        </RouteSuspense>
      } />
      <Route path="/wishlist" element={
        <RouteSuspense>
          <LibraryView
            onOpenDetail={onOpenDetail}
            onIncrementProgress={onIncrementProgress}
            onToggleFavorite={onToggleFavorite}
            onRequestDelete={onRequestDelete}
            pendingDeleteId={pendingDeleteId}
          />
        </RouteSuspense>
      } />
      <Route path="/discover" element={
        <RouteSuspense>
          <DiscoveryView
            library={library}
            apiKey={userProfile.apiKey}
            onSelectRecommendation={onRecommendationSelect}
            onToggleImmersive={onToggleImmersive}
          />
        </RouteSuspense>
      } />
      <Route path="/stats" element={
        <RouteSuspense>
          <StatsView
            library={library}
            userProfile={userProfile}
            onUpdateProfile={updateProfile}
          />
        </RouteSuspense>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
