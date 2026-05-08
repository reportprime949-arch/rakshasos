import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useEmergencyStore } from '@/store/useEmergencyStore';

export const useSocket = (token?: string) => {
  const socketRef = useRef<Socket | null>(null);
  const { id, updateStatus, assignOfficer } = useEmergencyStore();

  useEffect(() => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://rakshasos-backend.onrender.com';
    console.log('🔌 [CITIZEN SOCKET] Connecting to:', API_URL);

    const socket = io(API_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('✅ [CITIZEN SOCKET] Connected:', socket.id);
    });

    socket.on('officer_location_update', (data) => {
      const currentId = useEmergencyStore.getState().id;
      if (data.id === currentId || data.citizenId === 'CIT-12345') { // Match ID or citizenId
        console.log('🛰️ [OFFICER MOVED] New Coords:', data.lat, data.lng);
        assignOfficer({
          ...useEmergencyStore.getState().officer!,
          lat: data.lat,
          lng: data.lng,
        });
      }
    });

    socket.on('emergency:update', (data) => {
      // Use get() or check store state if needed, but 'id' from dependency is fine
      const currentId = useEmergencyStore.getState().id;
      if (data.id === currentId) {
        console.log('🔄 [CITIZEN REALTIME] Status Update:', data.status);
        
        if (data.status === 'assigned' || data.status === 'enroute' || data.status === 'arrived') {
          assignOfficer({
            id: data.officerId || 'OFF-123',
            name: data.officerName || 'Officer Response Team',
            badge: data.officerBadge || 'OFF-9921',
            phone: data.officerPhone || '+1 555-0123',
            lat: data.location.lat,
            lng: data.location.lng,
            eta: '4 Min',
          });
        }
        
        updateStatus(data.status.toUpperCase());
      }
    });

    socketRef.current = socket;

    return () => {
      console.log('🔌 [CITIZEN SOCKET] Disconnecting...');
      socket.disconnect();
    };
  }, [updateStatus, assignOfficer]);

  return socketRef.current;
};
