import { create } from 'zustand';

export type DispatchAlert = {
  id: string;
  citizenName: string;
  lat: number;
  lng: number;
  description: string;
};

interface OfficerState {
  officerId: string;
  officerName: string;
  isOnline: boolean;
  activeDispatch: DispatchAlert | null;
  status: 'IDLE' | 'ASSIGNED' | 'EN_ROUTE' | 'ARRIVED' | 'COMPLETED';
  
  // Actions
  setOnline: (online: boolean) => void;
  setDispatch: (dispatch: DispatchAlert | null) => void;
  setStatus: (status: OfficerState['status']) => void;
  clearDispatch: () => void;
}

export const useOfficerStore = create<OfficerState>((set) => ({
  officerId: 'OFF-9921',
  officerName: 'Officer Miller',
  isOnline: true, // Default to true for testing
  activeDispatch: null,
  status: 'IDLE',

  setOnline: (online) => set({ isOnline: online }),
  setDispatch: (dispatch) => set({ 
    activeDispatch: dispatch, 
    status: dispatch ? 'ASSIGNED' : 'IDLE' 
  }),
  setStatus: (status) => set({ status }),
  clearDispatch: () => set({ activeDispatch: null, status: 'IDLE' }),
}));
