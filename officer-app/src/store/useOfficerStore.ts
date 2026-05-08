import { create } from 'zustand';

export type DispatchAlert = {
  id: string;
  citizenName: string;
  lat: number;
  lng: number;
  description: string;
  status: string;
  emergencyType?: string;
  createdAt?: string;
};

interface OfficerState {
  officerId: string;
  officerName: string;
  isOnline: boolean;
  activeDispatch: DispatchAlert | null;
  activeIncidents: DispatchAlert[];
  status: 'IDLE' | 'ASSIGNED' | 'EN_ROUTE' | 'ARRIVED' | 'COMPLETED';
  socketStatus: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING';
  backendStatus: 'HEALTHY' | 'UNREACHABLE';
  
  // Actions
  setOnline: (online: boolean) => void;
  setDispatch: (dispatch: DispatchAlert | null) => void;
  setIncidents: (incidents: DispatchAlert[]) => void;
  addIncident: (incident: DispatchAlert) => void;
  updateIncident: (incident: DispatchAlert) => void;
  setStatus: (status: OfficerState['status']) => void;
  setSocketStatus: (status: OfficerState['socketStatus']) => void;
  setBackendStatus: (status: OfficerState['backendStatus']) => void;
  clearDispatch: () => void;
}

export const useOfficerStore = create<OfficerState>((set) => ({
  officerId: 'OFF-9921',
  officerName: 'Officer Miller',
  isOnline: true,
  activeDispatch: null,
  activeIncidents: [],
  status: 'IDLE',
  socketStatus: 'DISCONNECTED',
  backendStatus: 'HEALTHY',

  setOnline: (online) => set({ isOnline: online }),
  setDispatch: (dispatch) => set({ 
    activeDispatch: dispatch, 
    status: dispatch ? 'ASSIGNED' : 'IDLE' 
  }),
  setIncidents: (incidents) => set({ activeIncidents: incidents }),
  addIncident: (incident) => set((state) => {
    if (state.activeIncidents.find(i => i.id === incident.id)) return state;
    return { activeIncidents: [incident, ...state.activeIncidents] };
  }),
  updateIncident: (incident) => set((state) => ({
    activeIncidents: state.activeIncidents.map(i => i.id === incident.id ? { ...i, ...incident } : i)
  })),
  setStatus: (status) => set({ status }),
  setSocketStatus: (status) => set({ socketStatus: status }),
  setBackendStatus: (status) => set({ backendStatus: status }),
  clearDispatch: () => set({ activeDispatch: null, status: 'IDLE' }),
}));
