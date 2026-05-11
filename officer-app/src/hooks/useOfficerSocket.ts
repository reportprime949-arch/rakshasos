import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useOfficerStore, DispatchAlert } from '@/store/useOfficerStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://rakshasos-backend.onrender.com';

// ============================================================
// SINGLETON SOCKET MANAGER
// ============================================================
let sharedSocket: Socket | null = null;
let socketRefCount = 0;

function getSharedSocket(): Socket {
  if (!sharedSocket) {
    sharedSocket = io(API_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      auth: {
        token: typeof window !== 'undefined' ? localStorage.getItem('token') : null,
      },
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

// ============================================================
// HOOK
// ============================================================
export const useOfficerSocket = (officerId: string, officerName: string) => {
  const socketRef = useRef<Socket | null>(null);
  const processedIds = useRef<Set<string>>(new Set());
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getStore = useCallback(() => useOfficerStore.getState(), []);

  useEffect(() => {
    if (!officerId) return;

    const socket = getSharedSocket();
    socketRef.current = socket;

    const isDuplicate = (msgId?: string): boolean => {
      if (!msgId) return false;
      if (processedIds.current.has(msgId)) return true;
      processedIds.current.add(msgId);
      if (processedIds.current.size > 500) {
        const arr = Array.from(processedIds.current);
        processedIds.current = new Set(arr.slice(arr.length - 200));
      }
      return false;
    };

    socket.off('connect');
    socket.on('connect', () => {
      console.log('✅ [OFFICER SOCKET] Connected:', socket.id);
      getStore().setSocketStatus('CONNECTED');
      socket.emit('officer:join', {
        officerId,
        officerName,
        status: 'online',
        timestamp: Date.now(),
      });
      socket.emit('emergency:sync', { lastTimestamp: Date.now() - 30000 });
    });

    socket.off('disconnect');
    socket.on('disconnect', (reason) => {
      console.warn('❌ [OFFICER SOCKET] Disconnected:', reason);
      getStore().setSocketStatus('DISCONNECTED');
    });

    socket.off('connect_error');
    socket.on('connect_error', (err) => {
      console.warn('⚠️ [OFFICER SOCKET] Connection error:', err.message);
      getStore().setSocketStatus('CONNECTING');
    });

    socket.off('reconnect_attempt');
    socket.on('reconnect_attempt' as any, () => {
      getStore().setSocketStatus('CONNECTING');
    });

    socket.off('emergency:all');
    socket.on('emergency:all', (incidents: DispatchAlert[]) => {
      console.log('📦 [OFFICER SOCKET] Received emergency:all —', incidents.length, 'incidents');
      getStore().setIncidents(incidents);
    });

    socket.off('emergency:new');
    socket.on('emergency:new', (incident: DispatchAlert & { msgId?: string }) => {
      if (isDuplicate(incident.msgId)) return;
      console.log('🚨 [OFFICER SOCKET] NEW EMERGENCY:', incident.id, incident.citizenName);
      getStore().addIncident(incident);
      window.dispatchEvent(new CustomEvent('raksha:new-sos', { detail: { id: incident.id } }));
    });

    socket.off('emergency:update');
    socket.on('emergency:update', (incident: DispatchAlert & { msgId?: string }) => {
      if (isDuplicate(incident.msgId)) return;
      const store = getStore();
      if (incident.status === 'resolved' || incident.status === 'completed') {
        store.removeIncident(incident.id);
      } else {
        store.updateIncident(incident);
      }
    });

    socket.off('emergency:resolved');
    socket.on('emergency:resolved', ({ incidentId }: { incidentId: string }) => {
      getStore().removeIncident(incidentId);
    });

    socket.off('navigation:update');
    socket.on('navigation:update', (data: any) => {
      const activeDispatch = getStore().activeDispatch;
      if (activeDispatch && data.id === activeDispatch.id) {
        window.dispatchEvent(new CustomEvent('navigation:update', { detail: data }));
      }
    });

    socket.off('pong');
    socket.on('pong' as any, () => {});

    if (socket.connected) {
      getStore().setSocketStatus('CONNECTED');
      socket.emit('officer:join', { officerId, officerName, status: 'online' });
    }

    heartbeatRef.current = setInterval(() => {
      if (socket.connected) socket.emit('ping');
    }, 30000);

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('reconnect_attempt');
      socket.off('emergency:all');
      socket.off('emergency:new');
      socket.off('emergency:update');
      socket.off('emergency:resolved');
      socket.off('navigation:update');
      socket.off('pong');

      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }

      socketRef.current = null;
      releaseSharedSocket();
    };
  }, [officerId, officerName, getStore]);

  const acceptIncident = useCallback(
    (incidentId: string, offId: string) => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('officer:accept', {
          id: incidentId,
          officerId: offId,
          officerName,
          status: 'assigned',
          msgId: `acc_${Date.now()}_${incidentId}`,
        });
      }
    },
    [officerName],
  );

  const emitLocationUpdate = useCallback(
    (data: { officerId: string; latitude: number; longitude: number }) => {
      if (socketRef.current?.connected) {
        const activeDispatch = getStore().activeDispatch;
        socketRef.current.emit('officer:location_update', {
          ...data,
          incidentId: activeDispatch?.id || null,
          timestamp: Date.now(),
        });
      }
    },
    [getStore],
  );

  return { acceptIncident, emitLocationUpdate };
};
