import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useOfficerStore } from '@/store/useOfficerStore';

export const useOfficerSocket = (officerId: string, officerName: string) => {
  const socketRef = useRef<Socket | null>(null);
  const { setSocketStatus, addIncident, updateIncident, setIncidents } = useOfficerStore();

  useEffect(() => {
    if (!officerId) return;

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://rakshasos-backend.onrender.com';
    console.log('🔌 [SOCKET] Initializing connection to:', API_URL);

    const socket = io(API_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socket.on('connect', () => {
      console.log('✅ [SOCKET CONNECTED] Active ID:', socket.id);
      setSocketStatus('CONNECTED');
      
      // Register officer with backend
      socket.emit('officer:join', {
        officerId,
        officerName,
        status: 'online',
        timestamp: Date.now()
      });
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ [SOCKET DISCONNECTED] Reason:', reason);
      setSocketStatus('DISCONNECTED');
    });

    socket.on('connect_error', (error) => {
      console.error('⚠️ [SOCKET ERROR]:', error.message);
      setSocketStatus('CONNECTING');
    });

    socket.on('emergency:all', (incidents) => {
      console.log('📥 [BULK INCIDENT SYNC] Received:', incidents.length);
      setIncidents(incidents);
    });

    socket.on('emergency:new', (incident) => {
      console.log('🚨 [NEW INCIDENT RECEIVED]:', incident.id);
      addIncident(incident);
      
      // Trigger alarm if not already active
      window.dispatchEvent(new CustomEvent('trigger-alarm'));
    });

    socket.on('emergency:update', (incident) => {
      console.log('🔄 [INCIDENT UPDATED]:', incident.id, incident.status);
      updateIncident(incident);
    });

    socketRef.current = socket;

    return () => {
      console.log('🔌 [SOCKET] Cleaning up connection...');
      socket.disconnect();
    };
  }, [officerId, officerName]);

  const acceptIncident = (incidentId: string, officerId: string) => {
    if (socketRef.current && socketRef.current.connected) {
      console.log('👆 [ACTION] Accepting Incident via Socket:', incidentId);
      socketRef.current.emit('officer:accept', {
        id: incidentId,
        officerId,
        officerName,
        status: 'assigned'
      });
    } else {
      console.error('🔴 [ACTION FAILED] Socket not connected');
    }
  };

  return { socket: socketRef.current, acceptIncident };
};
