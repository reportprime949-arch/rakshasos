import { create } from 'zustand';

export type DispatchAlert = {
  id: string;
  citizenName: string;
  latitude: number;
  longitude: number;
  lat?: number; // Optional for backward compatibility during transition
  lng?: number; // Optional for backward compatibility during transition
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
  status: 'IDLE' | 'ASSIGNED' | 'EN_ROUTE' | 'ARRIVED' | 'RESOLVED' | 'COMPLETED';
  socketStatus: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING';
  backendStatus: 'HEALTHY' | 'UNREACHABLE';
  isLoading: boolean;
  
  // Actions
  setOnline: (online: boolean) => void;
  setDispatch: (dispatch: DispatchAlert | null) => void;
  setIncidents: (incidents: DispatchAlert[]) => void;
  addIncident: (incident: DispatchAlert) => void;
  updateIncident: (incident: DispatchAlert) => void;
  removeIncident: (id: string) => void;
  setStatus: (status: OfficerState['status']) => void;
  setSocketStatus: (status: OfficerState['socketStatus']) => void;
  setBackendStatus: (status: OfficerState['backendStatus']) => void;
  setLoading: (loading: boolean) => void;
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
  isLoading: true,

  setOnline: (online) => set({ isOnline: online }),
  setDispatch: (dispatch) => set((state) => {
    // Determine the status based on the dispatch object if it exists
    let newStatus: OfficerState['status'] = 'IDLE';
    if (dispatch) {
      const s = dispatch.status?.toUpperCase();
      if (s === 'ENROUTE' || s === 'EN_ROUTE') newStatus = 'EN_ROUTE';
      else if (s === 'ARRIVED') newStatus = 'ARRIVED';
      else if (s === 'RESOLVED') newStatus = 'RESOLVED';
      else if (s === 'COMPLETED') newStatus = 'COMPLETED';
      else newStatus = 'ASSIGNED';
    }
    
    return { 
      activeDispatch: dispatch, 
      status: newStatus
    };
  }),
  setIncidents: (incidents) => set({ activeIncidents: incidents, isLoading: false }),
  addIncident: (incident) => set((state) => {
    if (state.activeIncidents.find(i => i.id === incident.id)) return state;
    return { activeIncidents: [incident, ...state.activeIncidents] };
  }),
  updateIncident: (incident) => set((state) => {
    const updatedIncidents = state.activeIncidents.map(i => i.id === incident.id ? { ...i, ...incident } : i);
    
    // ALSO update activeDispatch if this is the currently handled incident
    let updatedDispatch = state.activeDispatch;
    let updatedStatus = state.status;
    
    if (state.activeDispatch && state.activeDispatch.id === incident.id) {
      updatedDispatch = { ...state.activeDispatch, ...incident };
      
      // Update status if provided
      if (incident.status) {
        const s = incident.status.toUpperCase();
        if (s === 'ENROUTE' || s === 'EN_ROUTE') updatedStatus = 'EN_ROUTE';
        else if (s === 'ARRIVED') updatedStatus = 'ARRIVED';
        else if (s === 'RESOLVED') updatedStatus = 'RESOLVED';
        else if (s === 'COMPLETED') updatedStatus = 'COMPLETED';
        else if (s === 'ASSIGNED') updatedStatus = 'ASSIGNED';
      }
    }
    
    return { 
      activeIncidents: updatedIncidents,
      activeDispatch: updatedDispatch,
      status: updatedStatus
    };
  }),
  removeIncident: (id) => set((state) => ({
    activeIncidents: state.activeIncidents.filter(i => i.id !== id)
  })),
  setStatus: (status) => set({ status }),
  setSocketStatus: (status) => set({ socketStatus: status }),
  setBackendStatus: (status) => set({ backendStatus: status }),
  setLoading: (loading) => set({ isLoading: loading }),
  clearDispatch: () => set({ activeDispatch: null, status: 'IDLE' }),
}));
