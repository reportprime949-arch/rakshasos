import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useOfficerStore, DispatchAlert } from '@/store/useOfficerStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// Singleton socket instance — prevents duplicate connections
let sharedSocket: Socket | null = null;
let socketRefCount = 0;

function getSharedSocket(): Socket {
  if (!sharedSocket || sharedSocket.disconnected) {
    console.log('🔌 [SOCKET] Creating shared connection to:', API_URL);
    sharedSocket = io(API_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 20000,
    });
  }
  socketRefCount++;
  return sharedSocket;
}

function releaseSharedSocket() {
  socketRefCount--;
  if (socketRefCount <= 0 && sharedSocket) {
    console.log('🔌 [SOCKET] All consumers released — disconnecting');
    sharedSocket.disconnect();
    sharedSocket = null;
    socketRefCount = 0;
  }
}

export const useOfficerSocket = (officerId: string, officerName: string) => {
  const socketRef = useRef<Socket | null>(null);
  
  // Use refs for store callbacks to avoid re-triggering socket setup
  const storeRef = useRef(useOfficerStore.getState());
  useEffect(() => {
    storeRef.current = useOfficerStore.getState();
    const unsub = useOfficerStore.subscribe((state) => {
      storeRef.current = state;
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!officerId) return;

    const socketInstance = getSharedSocket();

    socketInstance.on('connect', () => {
      console.log('✅ [SOCKET CONNECTED] Target:', API_URL, 'ID:', socketInstance.id);
      storeRef.current.setSocketStatus('CONNECTED');
      
      socketInstance.emit('officer:join', {
        officerId,
        officerName,
        status: 'online',
        timestamp: Date.now()
      });
    });

    socketInstance.on('disconnect', (reason) => {
      console.warn('❌ [SOCKET DISCONNECTED] Reason:', reason);
      storeRef.current.setSocketStatus('DISCONNECTED');
    });

    socketInstance.on('connect_error', (error) => {
      console.error('⚠️ [SOCKET CONNECTION ERROR]:', error.message);
      storeRef.current.setSocketStatus('CONNECTING');
    });

    socketInstance.on('emergency:all', (incidents: DispatchAlert[]) => {
      console.log('📥 [BULK INCIDENT SYNC] Received:', incidents.length);
      storeRef.current.setIncidents(incidents);
    });

    socketInstance.on('emergency:new', (incident: DispatchAlert) => {
      console.log('🚨 [NEW INCIDENT RECEIVED]:', incident.id);
      storeRef.current.addIncident(incident);
      window.dispatchEvent(new CustomEvent('trigger-alarm'));
    });

    socketInstance.on('emergency:update', (incident: DispatchAlert) => {
      console.log('🔄 [INCIDENT UPDATED]:', incident.id, incident.status);
      // If the incident was resolved/archived, remove it from active list
      if (incident.status === 'resolved' || incident.status === 'completed') {
        storeRef.current.removeIncident(incident.id);
      } else {
        storeRef.current.updateIncident(incident);
      }
    });

    // If already connected (singleton reuse), fire join immediately
    if (socketInstance.connected) {
      storeRef.current.setSocketStatus('CONNECTED');
      socketInstance.emit('officer:join', {
        officerId,
        officerName,
        status: 'online',
        timestamp: Date.now()
      });
    }

    socketRef.current = socketInstance;

    return () => {
      socketInstance.removeAllListeners();
      releaseSharedSocket();
    };
  }, [officerId, officerName]);

  const acceptIncident = useCallback((incidentId: string, officerId: string) => {
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
  }, [officerName]);

  // Expose the shared socket for location updates
  const emitLocationUpdate = useCallback((data: { officerId: string; latitude: number; longitude: number }) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('officer:location_update', {
        ...data,
        timestamp: Date.now()
      });
    }
  }, []);

  return { acceptIncident, emitLocationUpdate, socket: socketRef.current };
};
