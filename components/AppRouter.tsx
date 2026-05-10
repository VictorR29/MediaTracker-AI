import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { useLibraryStore } from '../stores/useLibraryStore';
import { Onboarding } from './Onboarding';
import { LoginScreen } from './LoginScreen';
import { LibraryView } from './LibraryView';
import { SearchView } from './SearchView';
import { ItemDetailView } from './ItemDetailView';
import { DiscoveryView } from './DiscoveryView';
import { StatsView } from './StatsView';
import { LoadingOverlay } from './LoadingOverlay';
import { MediaItem } from '../types';

interface AppRouterProps {
  onOpenDetail: (item: MediaItem) => void;
  onIncrementProgress: (item: MediaItem) => void;
  onToggleFavorite: (item: MediaItem) => void;
  onRequestDelete: (item: MediaItem) => void;
  onUpdateItem: (item: MediaItem) => void;
  onRecommendationSelect: (title: string, type: string) => void;
  onImportBackup: (file: File) => void;
  isRestoring: boolean;
  onToggleImmersive: (v: boolean) => void;
}

export const AppRouter: React.FC<AppRouterProps> = ({
  onOpenDetail,
  onIncrementProgress,
  onToggleFavorite,
  onRequestDelete,
  onUpdateItem,
  onRecommendationSelect,
  onImportBackup,
  isRestoring,
  onToggleImmersive,
}) => {
  const { userProfile, isAuthenticated, loading, login, completeOnboarding } = useAuthStore();
  const library = useLibraryStore(s => s.library);
  const updateProfile = useAuthStore(s => s.updateProfile);

  if (loading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Cargando...</div>;
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
        library={library}
      />
    );
  }

  return (
    <Routes>
      <Route path="/" element={
        <LibraryView
          onOpenDetail={onOpenDetail}
          onIncrementProgress={onIncrementProgress}
          onToggleFavorite={onToggleFavorite}
          onRequestDelete={onRequestDelete}
        />
      } />
      <Route path="/item/:id" element={
        <ItemDetailView
          onUpdateItem={onUpdateItem}
          onRequestDelete={onRequestDelete}
        />
      } />
      <Route path="/add" element={<SearchView onOpenDetail={onOpenDetail} />} />
      <Route path="/wishlist" element={
        <LibraryView
          onOpenDetail={onOpenDetail}
          onIncrementProgress={onIncrementProgress}
          onToggleFavorite={onToggleFavorite}
          onRequestDelete={onRequestDelete}
        />
      } />
      <Route path="/discover" element={
        <DiscoveryView
          library={library}
          apiKey={userProfile.apiKey}
          onSelectRecommendation={onRecommendationSelect}
          onToggleImmersive={onToggleImmersive}
        />
      } />
      <Route path="/stats" element={
        <StatsView
          library={library}
          userProfile={userProfile}
          onUpdateProfile={updateProfile}
        />
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
