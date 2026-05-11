import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAdminStore } from '@/store/useAdminStore';

export const useAdminSocket = (token?: string) => {
  const socketRef = useRef<Socket | null>(null);
  const { addEmergency, updateEmergency, updateOfficerLocation } = useAdminStore();

  useEffect(() => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://rakshasos-backend.onrender.com';
    const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || API_URL;
    console.log('🔌 [ADMIN SOCKET] Connecting to:', SOCKET_URL);

    const socket = io(SOCKET_URL, {
      transports: ['polling', 'websocket'],
      upgrade: true,
      reconnection: true,
      timeout: 30000,
    });

    socket.on('connect', () => {
      console.log('✅ [ADMIN SOCKET] Connected:', socket.id);
    });

    socket.on('emergency:new', (data) => {
      console.log('🚨 [ADMIN] NEW SOS RECEIVED:', data);
      const mappedData = {
        ...data,
        status: data.status.toUpperCase(),
        lat: data.location.lat,
        lng: data.location.lng,
      };
      addEmergency(mappedData);
      window.dispatchEvent(new CustomEvent('new-incident', { detail: mappedData }));
    });

    socket.on('emergency:update', (data) => {
      console.log('🔄 [ADMIN] SOS UPDATED:', data);
      const mappedData = {
        ...data,
        status: data.status.toUpperCase(),
        lat: data.location.lat,
        lng: data.location.lng,
      };
      updateEmergency(mappedData);
      window.dispatchEvent(new CustomEvent('incident-updated', { detail: mappedData }));
    });

    socket.on('officer_moved', (data) => {
      updateOfficerLocation(data.officerId, data.lat, data.lng);
    });

    socketRef.current = socket;

    return () => {
      console.log('🔌 [ADMIN SOCKET] Disconnecting...');
      socket.disconnect();
    };
  }, [addEmergency, updateEmergency, updateOfficerLocation]);

  return socketRef.current;
};
