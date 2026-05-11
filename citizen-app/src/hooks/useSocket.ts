import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useEmergencyStore } from '@/store/useEmergencyStore';
import { SOCKET_URL } from '@/lib/api';

export type SocketConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

// Singleton socket — prevents duplicate connections across renders and StrictMode
let sharedSocket: Socket | null = null;
let socketRefCount = 0;

function getSharedSocket(): Socket {
  if (!sharedSocket) {
    console.log('🔌 [CITIZEN SOCKET] Creating socket to:', SOCKET_URL);
    sharedSocket = io(SOCKET_URL, {
      // CRITICAL: Start with polling, then upgrade to websocket.
      // Render's proxy requires HTTP handshake first before WSS upgrade.
      transports: ['polling', 'websocket'],
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 30000,
      forceNew: false,
    });
  }
  socketRefCount++;
  return sharedSocket;
}

function releaseSharedSocket() {
  socketRefCount--;
  if (socketRefCount <= 0 && sharedSocket) {
    sharedSocket.disconnect();
    sharedSocket = null;
    socketRefCount = 0;
  }
}

export const useSocket = (token?: string) => {
  const socketRef = useRef<Socket | null>(null);
  const [connectionState, setConnectionState] = useState<SocketConnectionState>('connecting');
  const processedMessageIds = useRef<Set<string>>(new Set());
  const lastSyncTime = useRef<number>(Date.now());

  // Use refs for store callbacks to avoid re-triggering socket setup
  const storeRef = useRef(useEmergencyStore.getState());
  useEffect(() => {
    storeRef.current = useEmergencyStore.getState();
    const unsub = useEmergencyStore.subscribe((state) => {
      storeRef.current = state;
    });
    return unsub;
  }, []);

  const handleEvent = useCallback((id: string | undefined, callback: () => void) => {
    if (id && processedMessageIds.current.has(id)) {
      console.log('♻️ [CITIZEN SOCKET] Duplicate ignored:', id);
      return;
    }
    if (id) processedMessageIds.current.add(id);
    callback();
    lastSyncTime.current = Date.now();
  }, []);

  useEffect(() => {
    const socket = getSharedSocket();

    // Off before on to prevent listener stacking
    socket.off('connect');
    socket.on('connect', () => {
      console.log('✅ [CITIZEN SOCKET] Connected:', socket.id, '| Transport:', (socket as any).io?.engine?.transport?.name);
      setConnectionState('connected');
      
      const currentId = storeRef.current.id;
      if (currentId) {
        console.log('🛰️ [CITIZEN SOCKET] Joining incident room:', currentId);
        socket.emit('citizen:track', { incidentId: currentId });
      }

      // SYNC CATCH-UP
      socket.emit('emergency:sync', { lastTimestamp: lastSyncTime.current });
    });

    socket.off('connect_error');
    socket.on('connect_error', (err) => {
      console.warn('⚠️ [CITIZEN SOCKET] Connection error:', err.message);
      setConnectionState('reconnecting');
    });

    socket.off('disconnect');
    socket.on('disconnect', (reason) => {
      console.warn('❌ [CITIZEN SOCKET] Disconnected:', reason);
      setConnectionState('disconnected');
    });

    socket.off('officer_location_update');
    socket.on('officer_location_update', (data) => {
      const currentId = storeRef.current.id;
      if (data.id === currentId || data.citizenId === 'CIT-12345') {
        const currentOfficer = storeRef.current.officer;
        if (currentOfficer) {
          storeRef.current.assignOfficer({
            ...currentOfficer,
            latitude: data.latitude || data.lat,
            longitude: data.longitude || data.lng,
          });
        }
      }
    });

    socket.off('navigation:update');
    socket.on('navigation:update', (data) => {
      const currentId = storeRef.current.id;
      if (data.id === currentId) {
        window.dispatchEvent(new CustomEvent('navigation:update', { detail: data }));
      }
    });

    socket.off('emergency:update');
    socket.on('emergency:update', (data: any & { msgId?: string }) => {
      handleEvent(data.msgId, () => {
        const currentId = storeRef.current.id;
        if (data.id === currentId) {
          if (data.status === 'resolved' || data.status === 'completed') {
            storeRef.current.updateStatus('COMPLETED');
            return;
          }
          if (data.status === 'cancelled') {
            storeRef.current.updateStatus('CANCELLED');
            return;
          }
          if (['assigned', 'enroute', 'arrived'].includes(data.status)) {
            storeRef.current.assignOfficer({
              id: data.officerId || 'OFF-123',
              name: data.officerName || 'Officer Response Team',
              badge: data.officerBadge || 'OFF-9921',
              phone: data.officerPhone || '+1 555-0123',
              latitude: data.location?.lat || data.latitude || 0,
              longitude: data.location?.lng || data.longitude || 0,
              eta: data.status === 'arrived' ? 'Arrived' : '4 Min',
            });
          }
          const mappedStatus = data.status === 'enroute' ? 'EN_ROUTE' : data.status.toUpperCase();
          storeRef.current.updateStatus(mappedStatus);
        }
      });
    });

    if (socket.connected) {
      setConnectionState('connected');
    }

    socketRef.current = socket;

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('officer_location_update');
      socket.off('navigation:update');
      socket.off('emergency:update');
      releaseSharedSocket();
    };
  }, [handleEvent]);

  // Handle dynamic room joining when ID changes
  const incidentId = useEmergencyStore((s) => s.id);
  useEffect(() => {
    if (incidentId && socketRef.current?.connected) {
      console.log('🛰️ [CITIZEN SOCKET] Dynamic room join:', incidentId);
      socketRef.current.emit('citizen:track', { incidentId });
    }
  }, [incidentId]);

  return { socket: socketRef.current, connectionState };
};
