import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAdminStore } from '@/store/useAdminStore';

export const useAdminSocket = (token?: string) => {
  const socketRef = useRef<Socket | null>(null);
  const { addEmergency, updateEmergency, updateOfficerLocation } = useAdminStore();

  useEffect(() => {
    if (!token) return;

    const socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000', {
      auth: { token },
    });

    socket.on('emergency.created', (data) => {
      console.log('New Emergency Incident:', data);
      addEmergency(data);
    });

    socket.on('responder.assigned', (data) => {
      updateEmergency(data);
    });

    socket.on('emergency.resolved', (data) => {
      updateEmergency(data);
    });

    socket.on('officer_moved', (data) => {
      updateOfficerLocation(data.officerId, data.lat, data.lng);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [token, addEmergency, updateEmergency, updateOfficerLocation]);

  return socketRef.current;
};
