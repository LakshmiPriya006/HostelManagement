import { create } from 'zustand';
import type { Hostel } from '../types';

interface HostelState {
  hostels: Hostel[];
  selectedHostelId: string | null;
  setHostels: (hostels: Hostel[]) => void;
  setSelectedHostelId: (id: string | null) => void;
  getSelectedHostel: () => Hostel | null;
}

export const useHostelStore = create<HostelState>((set, get) => ({
  hostels: [],
  selectedHostelId: null,
  setHostels: (hostels) => set({ hostels, selectedHostelId: hostels.length > 0 ? (get().selectedHostelId || hostels[0].id) : null }),
  setSelectedHostelId: (id) => set({ selectedHostelId: id }),
  getSelectedHostel: () => {
    const { hostels, selectedHostelId } = get();
    return hostels.find(h => h.id === selectedHostelId) || null;
  },
}));
