import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useEmergencyStore } from '@/store/useEmergencyStore';
import { SOCKET_URL } from '@/lib/api';

export const useSocket = (token?: string) => {
  const socketRef = useRef<Socket | null>(null);
  const { updateStatus, assignOfficer } = useEmergencyStore();

  useEffect(() => {
    console.log('🔌 [CITIZEN SOCKET] Connecting to:', SOCKET_URL);

    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socket.on('connect', () => {
      console.log('✅ [CITIZEN SOCKET] Connected:', socket.id);
    });

    socket.on('connect_error', (err) => {
      console.warn('⚠️ [CITIZEN SOCKET] Connection error:', err.message);
    });

    socket.on('disconnect', (reason) => {
      console.warn('❌ [CITIZEN SOCKET] Disconnected:', reason);
    });

    socket.on('officer_location_update', (data) => {
      const currentId = useEmergencyStore.getState().id;
      if (data.id === currentId || data.citizenId === 'CIT-12345') {
        console.log('🛰️ [OFFICER MOVED] New Coords:', data.lat, data.lng);
        const currentOfficer = useEmergencyStore.getState().officer;
        if (currentOfficer) {
          assignOfficer({
            ...currentOfficer,
            lat: data.lat,
            lng: data.lng,
          });
        }
      }
    });

    socket.on('emergency:update', (data) => {
      const currentId = useEmergencyStore.getState().id;
      if (data.id === currentId) {
        console.log('🔄 [CITIZEN REALTIME] Status Update:', data.status);
        
        if (data.status === 'assigned' || data.status === 'enroute' || data.status === 'arrived') {
          assignOfficer({
            id: data.officerId || 'OFF-123',
            name: data.officerName || 'Officer Response Team',
            badge: data.officerBadge || 'OFF-9921',
            phone: data.officerPhone || '+1 555-0123',
            lat: data.location?.lat || 0,
            lng: data.location?.lng || 0,
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
