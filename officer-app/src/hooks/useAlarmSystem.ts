import { useEffect, useRef, useCallback } from 'react';
import { useOfficerStore } from '@/store/useOfficerStore';

/**
 * useAlarmSystem — AudioContext-based alarm for SOS alerts.
 *
 * - Unlocks audio on first user interaction (click/touch)
 * - Preloads alarm sound buffer
 * - Plays once per new SOS (deduped by incident ID)
 * - Provides mute/unmute toggle
 * - Vibration fallback
 * - Full cleanup on unmount
 */
export const useAlarmSystem = () => {
  const audioMuted = useOfficerStore((s) => s.audioMuted);
  const setAudioMuted = useOfficerStore((s) => s.setAudioMuted);
  const lastSOSId = useOfficerStore((s) => s.lastSOSId);
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

  // Expose alarm active state via a simple state tracker (no React state to avoid rerenders)
  const alarmActiveCallbackRef = useRef<((active: boolean) => void) | null>(null);

  // ----------------------------------------------------------
  // INIT: Create AudioContext + preload buffer
  // ----------------------------------------------------------
  const initAudio = useCallback(async () => {
    if (ctxRef.current) return;
    try {
      console.log('🔊 [ALARM] Initializing AudioContext...');
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      ctxRef.current = ctx;

      // Preload alarm sound
      const response = await fetch('/sounds/alarm.mp3');
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        bufferRef.current = await ctx.decodeAudioData(arrayBuffer);
        console.log('🔊 [ALARM] Audio buffer preloaded successfully');
      } else {
        console.warn('⚠️ [ALARM] Failed to fetch alarm sound:', response.status);
      }
    } catch (e) {
      console.warn('⚠️ [ALARM] AudioContext init failed:', e);
    }
  }, []);

  // ----------------------------------------------------------
  // UNLOCK: Resume AudioContext after user gesture
  // ----------------------------------------------------------
  useEffect(() => {
    const unlock = async () => {
      if (unlockedRef.current) return;
      await initAudio();
      if (ctxRef.current?.state === 'suspended') {
        await ctxRef.current.resume();
      }
      unlockedRef.current = true;
      console.log('🔓 [ALARM] Audio unlocked via user gesture');
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

  // ----------------------------------------------------------
  // PLAY ALARM
  // ----------------------------------------------------------
  const playAlarm = useCallback(() => {
    console.log('🔔 [ALARM] playAlarm() called, isPlaying:', isPlayingRef.current, 'muted:', audioMuted);
    
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;
    isAlarmActiveRef.current = true;
    alarmActiveCallbackRef.current?.(true);

    // Audio playback
    if (!audioMuted) {
      let audioPlayed = false;

      // Strategy 1: AudioContext (preferred — lower latency)
      if (ctxRef.current && bufferRef.current && unlockedRef.current) {
        try {
          // Stop any existing source
          if (sourceRef.current) {
            try { sourceRef.current.stop(); } catch (_) { /* already stopped */ }
          }

          const source = ctxRef.current.createBufferSource();
          source.buffer = bufferRef.current;
          source.loop = true;
          source.connect(ctxRef.current.destination);
          source.start(0);
          sourceRef.current = source;
          audioPlayed = true;
          console.log('🔊 [ALARM] Playing via AudioContext');
        } catch (e) {
          console.warn('⚠️ [ALARM] AudioContext playback failed:', e);
        }
      }

      // Strategy 2: HTMLAudioElement fallback
      if (!audioPlayed) {
        try {
          console.log('🔊 [ALARM] Falling back to HTMLAudioElement');
          const audio = new Audio('/sounds/alarm.mp3');
          audio.loop = true;
          audio.volume = 1;
          audio.play().then(() => {
            console.log('🔊 [ALARM] HTMLAudioElement playing');
          }).catch((err) => {
            console.warn('⚠️ [ALARM] HTMLAudioElement play failed (autoplay blocked?):', err);
          });
          fallbackAudioRef.current = audio;
        } catch (_) { /* ignore */ }
      }
    } else {
      console.log('🔇 [ALARM] Audio muted — visual alarm only');
    }

    // Vibration fallback
    if ('vibrate' in navigator) {
      vibrationTimerRef.current = setInterval(() => {
        navigator.vibrate([500, 300, 500, 300, 1000]);
      }, 3000);
    }
  }, [audioMuted]);

  // ----------------------------------------------------------
  // STOP ALARM
  // ----------------------------------------------------------
  const stopAlarm = useCallback(() => {
    console.log('🔕 [ALARM] stopAlarm() called');
    isPlayingRef.current = false;
    isAlarmActiveRef.current = false;
    alarmActiveCallbackRef.current?.(false);

    // Stop AudioContext source
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch (_) { /* already stopped */ }
      sourceRef.current = null;
    }

    // Stop fallback audio
    if (fallbackAudioRef.current) {
      fallbackAudioRef.current.pause();
      fallbackAudioRef.current.currentTime = 0;
      fallbackAudioRef.current = null;
    }

    // Stop vibration
    if (vibrationTimerRef.current) {
      clearInterval(vibrationTimerRef.current);
      vibrationTimerRef.current = null;
    }
    if ('vibrate' in navigator) {
      navigator.vibrate(0);
    }
  }, []);

  // ----------------------------------------------------------
  // TOGGLE MUTE
  // ----------------------------------------------------------
  const toggleMute = useCallback(() => {
    const newMuted = !useOfficerStore.getState().audioMuted;
    setAudioMuted(newMuted);
    if (newMuted && isPlayingRef.current) {
      // Mute: stop sound but keep visual alarm active
      if (sourceRef.current) {
        try { sourceRef.current.stop(); } catch (_) { /* ignore */ }
        sourceRef.current = null;
      }
      if (fallbackAudioRef.current) {
        fallbackAudioRef.current.pause();
        fallbackAudioRef.current = null;
      }
    }
  }, [setAudioMuted]);

  // ----------------------------------------------------------
  // LISTEN FOR NEW SOS EVENTS
  // ----------------------------------------------------------
  useEffect(() => {
    const handleNewSOS = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const sosId = detail?.id;
      if (!sosId) return;

      console.log('🚨 [ALARM] raksha:new-sos event received, ID:', sosId);

      // Only play for genuinely new SOS
      const currentLastId = useOfficerStore.getState().lastSOSId;
      if (sosId === currentLastId) {
        console.log('♻️ [ALARM] Same SOS ID as last — skipping alarm');
        return;
      }

      setLastSOSId(sosId);
      console.log('🔔 [ALARM] Triggering alarm for SOS:', sosId);
      playAlarm();
    };

    window.addEventListener('raksha:new-sos', handleNewSOS);
    return () => window.removeEventListener('raksha:new-sos', handleNewSOS);
  }, [playAlarm, setLastSOSId]);

  // ----------------------------------------------------------
  // CLEANUP
  // ----------------------------------------------------------
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
