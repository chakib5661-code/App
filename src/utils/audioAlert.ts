/**
 * Real-time Web Audio Synthesizer for live order & access request notifications
 * Works completely client-side without any external MP3/WAV assets.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!audioCtx && AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch (e) {
    return null;
  }
}

/**
 * Gentle chime for new pre-orders & proforma requests
 */
export function playOrderNotificationSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Harmonic double bell (E5 -> A5)
    const notes = [
      { freq: 659.25, start: 0, duration: 0.35, gain: 0.15 },
      { freq: 880.0, start: 0.12, duration: 0.55, gain: 0.2 },
    ];

    notes.forEach(({ freq, start, duration, gain }) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + start);

      gainNode.gain.setValueAtTime(gain, now + start);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(now + start);
      osc.stop(now + start + duration);
    });
  } catch (err) {
    console.debug('[Audio Alert] Sound playback suppressed:', err);
  }
}

/**
 * Bright chime for new professional access requests
 */
export function playAccessNotificationSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Bright ascending arpeggio (C5 -> E5 -> G5)
    const notes = [
      { freq: 523.25, start: 0, duration: 0.25, gain: 0.12 },
      { freq: 659.25, start: 0.1, duration: 0.3, gain: 0.15 },
      { freq: 783.99, start: 0.2, duration: 0.55, gain: 0.2 },
    ];

    notes.forEach(({ freq, start, duration, gain }) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + start);

      gainNode.gain.setValueAtTime(gain, now + start);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(now + start);
      osc.stop(now + start + duration);
    });
  } catch (err) {
    console.debug('[Audio Alert] Sound playback suppressed:', err);
  }
}
