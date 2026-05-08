import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useOfficerStore } from '@/store/useOfficerStore';

export const useOfficerSocket = (token?: string) => {
  const socketRef = useRef<Socket | null>(null);
  const { setDispatch, isOnline } = useOfficerStore();

  useEffect(() => {
    if (!token || !isOnline) {
      if (socketRef.current) socketRef.current.disconnect();
      return;
    }

    const socket = io(process.env.NEXT_PUBLIC_API_URL || 'https://rakshasos-backend.onrender.com', {
      auth: { token },
    });

    socket.on('responder.assigned', (data) => {
      console.log('Dispatch Assigned:', data);
      setDispatch({
        id: data.id,
        citizenName: data.citizen.name,
        lat: data.latitude,
        lng: data.longitude,
        description: data.description,
      });
      
      if (window.navigator.vibrate) window.navigator.vibrate([500, 200, 500, 200, 500]);
    });

    socket.on('emergency.cancelled', () => {
      setDispatch(null);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [token, isOnline, setDispatch]);

  return socketRef.current;
};
