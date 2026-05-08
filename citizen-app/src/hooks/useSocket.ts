import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useEmergencyStore } from '@/store/useEmergencyStore';

export const useSocket = (token?: string) => {
  const socketRef = useRef<Socket | null>(null);
  const { updateStatus, assignOfficer } = useEmergencyStore();

  useEffect(() => {
    if (!token) return;

    const socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000', {
      auth: { token },
      extraHeaders: {
        Authorization: `Bearer ${token}`
      }
    });

    socket.on('connect', () => {
      console.log('Connected to dispatch server');
    });

    socket.on('officer_dispatched', (data) => {
      console.log('Officer Dispatched:', data);
      // Data would contain officer info
      assignOfficer({
        name: data.officerName || 'Officer Assigned',
        badge: data.badge || 'B-000',
        phone: data.phone || '',
        lat: data.lat,
        lng: data.lng,
        eta: 'Calculating...',
      });
    });

    socket.on('status_update', (data) => {
      updateStatus(data.status);
    });

    socket.on('officer_location_update', (data) => {
      // Update officer location in store
      // This would require an action in useEmergencyStore to update officer position
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [token, updateStatus, assignOfficer]);

  return socketRef.current;
};
