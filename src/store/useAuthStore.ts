import { create } from 'zustand';

export interface User {
  id: string;
  username: string;
  email: string | null;
  avatarUrl: string | null;
  role: string;
  isArtist: boolean;
  canUpload: boolean;
  onboardingCompleted: boolean;
  isFounderUser: boolean;
  trustScore?: number;
  badge?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setAuthenticated: (value: boolean) => void;
  setLoading: (value: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setAuthenticated: (value) => set({ isAuthenticated: value }),
  setLoading: (value) => set({ isLoading: value }),
  logout: () => set({ user: null, isAuthenticated: false }),
}));
