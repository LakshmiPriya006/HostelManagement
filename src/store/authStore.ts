import { create } from 'zustand';
import type { User, Session } from '@supabase/supabase-js';
import type { UserRole, Owner, Hosteller } from '../types';

interface AuthState {
  user: User | null;
  session: Session | null;
  role: UserRole | null;
  ownerProfile: Owner | null;
  hostellerProfile: Hosteller | null;
  currentDomain: 'owner' | 'hosteller' | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setRole: (role: UserRole | null) => void;
  setOwnerProfile: (profile: Owner | null) => void;
  setHostellerProfile: (profile: Hosteller | null) => void;
  setCurrentDomain: (domain: 'owner' | 'hosteller' | null) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  role: null,
  ownerProfile: null,
  hostellerProfile: null,
  currentDomain: null,
  loading: true,
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setRole: (role) => set({ role }),
  setOwnerProfile: (ownerProfile) => set({ ownerProfile }),
  setHostellerProfile: (hostellerProfile) => set({ hostellerProfile }),
  setCurrentDomain: (currentDomain) => set({ currentDomain }),
  setLoading: (loading) => set({ loading }),
  reset: () => set({ user: null, session: null, role: null, ownerProfile: null, hostellerProfile: null }),
}));
