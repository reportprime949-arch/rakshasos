import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export const useOfficerSocket = (officerId: string) => {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!officerId) return;

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://rakshasos-backend.onrender.com';
    console.log('🔌 [OFFICER SOCKET] Connecting to:', API_URL);

    const socket = io(API_URL, {
      transports: ['websocket'],
      reconnection: true,
    });

    socket.on('connect', () => {
      console.log('✅ [OFFICER SOCKET] Connected:', socket.id);
    });

    socket.on('emergency:new', (data) => {
      console.log('🚨 [NEW INCIDENT RECEIVED]:', data);
      // Trigger browser notification or sound
      const audio = new Audio('/alarm.mp3');
      audio.play().catch(e => console.log('Audio play failed', e));
      
      // Dispatch custom event for UI updates
      window.dispatchEvent(new CustomEvent('new-incident', { detail: data }));
    });

    socket.on('emergency:update', (data) => {
      console.log('🔄 [INCIDENT UPDATED]:', data);
      window.dispatchEvent(new CustomEvent('incident-updated', { detail: data }));
    });

    socketRef.current = socket;

    return () => {
      console.log('🔌 [OFFICER SOCKET] Disconnecting...');
      socket.disconnect();
    };
  }, [officerId]);

  const acceptIncident = (incidentId: string) => {
    if (socketRef.current) {
      console.log('👆 [OFFICER ACTION] Accepting Incident:', incidentId);
      socketRef.current.emit('officer:accept', {
        id: incidentId,
        officerId,
        status: 'assigned'
      });
    }
  };

  return { socket: socketRef.current, acceptIncident };
};
