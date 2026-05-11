import { useEffect, useRef, useCallback } from 'react';
import { useOfficerStore } from '@/store/useOfficerStore';

/**
 * useAlarmSystem — AudioContext-based alarm for SOS alerts.
 */
export const useAlarmSystem = () => {
  const audioMuted = useOfficerStore((s) => s.audioMuted);
  const setAudioMuted = useOfficerStore((s) => s.setAudioMuted);
  const setLastSOSId = useOfficerStore((s) => s.setLastSOSId);

  const ctxRef = useRef<AudioContext | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const fallbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingRef = useRef(false);
  const unlockedRef = useRef(false);
  const vibrationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isAlarmActiveRef = useRef(false);
  const mountedRef = useRef(true);
  const alarmActiveCallbackRef = useRef<((active: boolean) => void) | null>(null);

  const initAudio = useCallback(async () => {
    if (ctxRef.current) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      ctxRef.current = ctx;
      const response = await fetch('/sounds/alarm.mp3');
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        bufferRef.current = await ctx.decodeAudioData(arrayBuffer);
      }
    } catch (e) {
      // Degrade gracefully
    }
  }, []);

  useEffect(() => {
    const unlock = async () => {
      if (unlockedRef.current) return;
      await initAudio();
      if (ctxRef.current?.state === 'suspended') {
        await ctxRef.current.resume();
      }
      unlockedRef.current = true;
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
    };

    window.addEventListener('click', unlock, { once: false });
    window.addEventListener('touchstart', unlock, { once: false });

    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
    };
  }, [initAudio]);

  const playAlarm = useCallback(() => {
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;
    isAlarmActiveRef.current = true;
    alarmActiveCallbackRef.current?.(true);

    if (!audioMuted) {
      let played = false;
      if (ctxRef.current && bufferRef.current && unlockedRef.current) {
        try {
          if (sourceRef.current) {
            try { sourceRef.current.stop(); } catch (_) {}
          }
          const source = ctxRef.current.createBufferSource();
          source.buffer = bufferRef.current;
          source.loop = true;
          source.connect(ctxRef.current.destination);
          source.start(0);
          sourceRef.current = source;
          played = true;
        } catch (e) {}
      }

      if (!played) {
        try {
          const audio = new Audio('/sounds/alarm.mp3');
          audio.loop = true;
          audio.volume = 1;
          audio.play().catch(() => {});
          fallbackAudioRef.current = audio;
        } catch (_) {}
      }
    }

    if ('vibrate' in navigator) {
      vibrationTimerRef.current = setInterval(() => {
        navigator.vibrate([500, 300, 500, 300, 1000]);
      }, 3000);
    }
  }, [audioMuted]);

  const stopAlarm = useCallback(() => {
    isPlayingRef.current = false;
    isAlarmActiveRef.current = false;
    alarmActiveCallbackRef.current?.(false);

    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch (_) {}
      sourceRef.current = null;
    }
    if (fallbackAudioRef.current) {
      fallbackAudioRef.current.pause();
      fallbackAudioRef.current.currentTime = 0;
      fallbackAudioRef.current = null;
    }
    if (vibrationTimerRef.current) {
      clearInterval(vibrationTimerRef.current);
      vibrationTimerRef.current = null;
    }
    if ('vibrate' in navigator) {
      navigator.vibrate(0);
    }
  }, []);

  const toggleMute = useCallback(() => {
    const newMuted = !useOfficerStore.getState().audioMuted;
    setAudioMuted(newMuted);
    if (newMuted && isPlayingRef.current) {
      if (sourceRef.current) {
        try { sourceRef.current.stop(); } catch (_) {}
        sourceRef.current = null;
      }
      if (fallbackAudioRef.current) {
        fallbackAudioRef.current.pause();
        fallbackAudioRef.current = null;
      }
    }
  }, [setAudioMuted]);

  useEffect(() => {
    const handleNewSOS = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const sosId = detail?.id;
      if (!sosId) return;

      const currentLastId = useOfficerStore.getState().lastSOSId;
      if (sosId === currentLastId) return;

      setLastSOSId(sosId);
      playAlarm();
    };

    window.addEventListener('raksha:new-sos', handleNewSOS);
    return () => window.removeEventListener('raksha:new-sos', handleNewSOS);
  }, [playAlarm, setLastSOSId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopAlarm();
      if (ctxRef.current) {
        ctxRef.current.close().catch(() => {});
        ctxRef.current = null;
      }
    };
  }, [stopAlarm]);

  return {
    playAlarm,
    stopAlarm,
    toggleMute,
    isAlarmActive: isAlarmActiveRef,
    onAlarmActiveChange: alarmActiveCallbackRef,
  };
};
