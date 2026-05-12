import { create } from 'zustand';

export type DispatchAlert = {
  id: string;
  citizenName: string;
  latitude: number;
  longitude: number;
  lat?: number;
  lng?: number;
  description: string;
  status: string;
  emergencyType?: string;
  createdAt?: string;
  assignedOfficerId?: string;
  officerName?: string;
  distanceKm?: number;
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
  firestoreStatus: 'SYNCED' | 'ERROR' | 'INITIALIZING';
  isLoading: boolean;
  audioMuted: boolean;
  lastSOSId: string | null;

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
  setFirestoreStatus: (status: OfficerState['firestoreStatus']) => void;
  setLoading: (loading: boolean) => void;
  setAudioMuted: (muted: boolean) => void;
  setLastSOSId: (id: string | null) => void;
  clearDispatch: () => void;
  reset: () => void;
}

function resolveStatus(statusStr?: string): OfficerState['status'] {
  if (!statusStr) return 'ASSIGNED';
  const s = statusStr.toUpperCase();
  if (s === 'ENROUTE' || s === 'EN_ROUTE') return 'EN_ROUTE';
  if (s === 'ARRIVED') return 'ARRIVED';
  if (s === 'RESOLVED') return 'RESOLVED';
  if (s === 'COMPLETED') return 'COMPLETED';
  if (s === 'ASSIGNED') return 'ASSIGNED';
  return 'ASSIGNED';
}

const initialState = {
  activeDispatch: null as DispatchAlert | null,
  activeIncidents: [] as DispatchAlert[],
  status: 'IDLE' as const,
  socketStatus: 'DISCONNECTED' as const,
  backendStatus: 'HEALTHY' as const,
  firestoreStatus: 'INITIALIZING' as const,
  isLoading: true,
  audioMuted: false,
  lastSOSId: null as string | null,
};

export const useOfficerStore = create<OfficerState>((set) => ({
  officerId: 'OFF-9921',
  officerName: 'Officer Miller',
  isOnline: true,
  ...initialState,

  setOnline: (online) => set({ isOnline: online }),

  setDispatch: (dispatch) =>
    set(() => ({
      activeDispatch: dispatch,
      status: dispatch ? resolveStatus(dispatch.status) : 'IDLE',
    })),

  setIncidents: (incidents) => set({ activeIncidents: incidents, isLoading: false }),

  addIncident: (incident) =>
    set((state) => {
      if (state.activeIncidents.some((i) => i.id === incident.id)) return state;
      return { activeIncidents: [incident, ...state.activeIncidents] };
    }),

  updateIncident: (incident) =>
    set((state) => {
      const updatedIncidents = state.activeIncidents.map((i) =>
        i.id === incident.id ? { ...i, ...incident } : i,
      );

      let updatedDispatch = state.activeDispatch;
      let updatedStatus = state.status;

      if (state.activeDispatch && state.activeDispatch.id === incident.id) {
        updatedDispatch = { ...state.activeDispatch, ...incident };
        if (incident.status) {
          updatedStatus = resolveStatus(incident.status);
        }
      }

      return {
        activeIncidents: updatedIncidents,
        activeDispatch: updatedDispatch,
        status: updatedStatus,
      };
    }),

  removeIncident: (id) =>
    set((state) => {
      const newState: Partial<OfficerState> = {
        activeIncidents: state.activeIncidents.filter((i) => i.id !== id),
      };
      // Also clear dispatch if it matches the removed incident
      if (state.activeDispatch?.id === id) {
        newState.activeDispatch = null;
        newState.status = 'IDLE';
      }
      return newState;
    }),

  setStatus: (status) => set({ status }),
  setSocketStatus: (status) => set({ socketStatus: status }),
  setBackendStatus: (status) => set({ backendStatus: status }),
  setFirestoreStatus: (status) => set({ firestoreStatus: status }),
  setLoading: (loading) => set({ isLoading: loading }),
  setAudioMuted: (muted) => set({ audioMuted: muted }),
  setLastSOSId: (id) => set({ lastSOSId: id }),
  clearDispatch: () => set({ activeDispatch: null, status: 'IDLE' }),
  reset: () =>
    set((state) => ({
      ...initialState,
      officerId: state.officerId,
      officerName: state.officerName,
      isOnline: state.isOnline,
      activeDispatch: null,
      activeIncidents: [],
      status: 'IDLE',
    })),
}));
