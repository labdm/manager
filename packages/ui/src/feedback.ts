const SOUND_KEY = "manager.sound.muted";

export function readSoundMuted(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeSoundMuted(muted: boolean): void {
  try {
    localStorage.setItem(SOUND_KEY, muted ? "1" : "0");
  } catch {
    // Private mode can reject storage. The toggle still updates this session.
  }
}

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  } catch {
    return false;
  }
}

/** Short synthesized chime. No audio file. */
export function playCompleteSound(): void {
  if (readSoundMuted() || prefersReducedMotion()) return;
  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  try {
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    const start = ctx.currentTime;
    osc.frequency.setValueAtTime(523.25, start);
    osc.frequency.exponentialRampToValueAtTime(783.99, start + 0.12);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.06, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.3);
    osc.onended = () => {
      void ctx.close();
    };
  } catch {
    // Autoplay policies and missing devices stay silent.
  }
}

export function vibrateComplete(sectionClear: boolean): void {
  if (prefersReducedMotion()) return;
  try {
    navigator.vibrate?.(sectionClear ? [12, 40, 18] : 12);
  } catch {
    // vibrate can exist and still throw.
  }
}
