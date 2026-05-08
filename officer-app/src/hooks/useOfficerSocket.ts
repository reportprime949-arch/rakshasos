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

    const socketInstance = io(API_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socketInstance.on('connect', () => {
      console.log('✅ [SOCKET CONNECTED] Target:', API_URL, 'ID:', socketInstance.id);
      setSocketStatus('CONNECTED');
      
      socketInstance.emit('officer:join', {
        officerId,
        officerName,
        status: 'online',
        timestamp: Date.now()
      });
    });

    socketInstance.on('disconnect', (reason) => {
      console.warn('❌ [SOCKET DISCONNECTED] Reason:', reason);
      setSocketStatus('DISCONNECTED');
    });

    socketInstance.on('connect_error', (error) => {
      console.error('⚠️ [SOCKET CONNECTION ERROR]:', error.message, 'Target:', API_URL);
      setSocketStatus('CONNECTING');
    });

    socketInstance.on('emergency:all', (incidents: DispatchAlert[]) => {
      console.log('📥 [BULK INCIDENT SYNC] Received:', incidents.length);
      setIncidents(incidents);
    });

    socketInstance.on('emergency:new', (incident: DispatchAlert) => {
      console.log('🚨 [NEW INCIDENT RECEIVED]:', incident.id);
      addIncident(incident);
      window.dispatchEvent(new CustomEvent('trigger-alarm'));
    });

    socketInstance.on('emergency:update', (incident: DispatchAlert) => {
      console.log('🔄 [INCIDENT UPDATED]:', incident.id, incident.status);
      updateIncident(incident);
    });

    socketRef.current = socketInstance;

    return () => {
      console.log('🔌 [SOCKET] Cleaning up connection...');
      socketInstance.disconnect();
    };
  }, [officerId, officerName, addIncident, setIncidents, setSocketStatus, updateIncident]);

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

  return { acceptIncident };
};
