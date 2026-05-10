import { create } from 'zustand';
import { UserProfile } from '../types';
import { saveUserProfile, getUserProfile } from '../services/storage';
import { hashPassword, verifyPassword } from '../utils/password';

interface AuthState {
  userProfile: UserProfile | null;
  isAuthenticated: boolean;
  loading: boolean;
  init: () => Promise<void>;
  login: (password: string) => Promise<boolean>;
  logout: () => void;
  updateProfile: (profile: UserProfile) => Promise<void>;
  completeOnboarding: (profile: UserProfile) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  userProfile: null,
  isAuthenticated: false,
  loading: true,

  init: async () => {
    try {
      const profile = await getUserProfile();
      if (profile) {
        set({ userProfile: profile, isAuthenticated: !profile.password, loading: false });
      } else {
        set({ loading: false });
      }
    } catch (e) {
      console.error('Failed to init auth', e);
      set({ loading: false });
    }
  },

  login: async (password: string) => {
    const { userProfile } = get();
    if (!userProfile?.password) {
      set({ isAuthenticated: true });
      return true;
    }
    const { valid, needsRehash } = await verifyPassword(password, userProfile.password);
    if (valid) {
      if (needsRehash) {
        const hashedPassword = await hashPassword(password);
        const updatedProfile = { ...userProfile, password: hashedPassword };
        await saveUserProfile(updatedProfile);
        set({ userProfile: updatedProfile, isAuthenticated: true });
      } else {
        set({ isAuthenticated: true });
      }
      return true;
    }
    return false;
  },

  logout: () => set({ isAuthenticated: false }),

  updateProfile: async (profile: UserProfile) => {
    await saveUserProfile(profile);
    set({ userProfile: profile });
  },

  completeOnboarding: async (profile: UserProfile) => {
    const profileToSave = profile.password
      ? { ...profile, password: await hashPassword(profile.password) }
      : profile;
    await saveUserProfile(profileToSave);
    set({ userProfile: profileToSave, isAuthenticated: true });
  },
}));
