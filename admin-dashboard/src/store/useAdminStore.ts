import { create } from 'zustand';

export interface EmergencySession {
  id: string;
  status: string;
  latitude: number;
  longitude: number;
  lat: number;
  lng: number;
  citizenName?: string;
  citizen?: { name: string; phone: string };
  officer?: { user: { name: string; badgeNumber: string } };
  createdAt: string;
  emergencyType?: string;
}

interface AdminState {
  emergencies: EmergencySession[];
  activeOfficers: any[];
  
  addEmergency: (session: EmergencySession) => void;
  updateEmergency: (session: EmergencySession) => void;
  setEmergencies: (emergencies: any[]) => void;
  setOfficers: (officers: any[]) => void;
  updateOfficerLocation: (officerId: string, lat: number, lng: number) => void;
}

export const useAdminStore = create<AdminState>((set) => ({
  emergencies: [],
  activeOfficers: [],

  addEmergency: (session) => set((state) => ({ 
    emergencies: [session, ...state.emergencies] 
  })),

  updateEmergency: (session) => set((state) => ({
    emergencies: state.emergencies.map(e => e.id === session.id ? session : e)
  })),

  setEmergencies: (emergencies) => set({ emergencies }),

  setOfficers: (activeOfficers) => set({ activeOfficers }),

  updateOfficerLocation: (officerId, lat, lng) => set((state) => ({
    activeOfficers: state.activeOfficers.map(o => o.id === officerId ? { ...o, lat, lng } : o)
  })),
}));
