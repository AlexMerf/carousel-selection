type AudioContextConstructor = typeof AudioContext;

/**
 * Tiny WebAudio kit: no audio files, everything is synthesised on the fly.
 * The context is created lazily on the first user gesture (autoplay rules).
 */
class SoundKit {
  enabled = true;

  private ctx: AudioContext | null = null;

  private ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (this.ctx) return this.ctx;
    const Ctor: AudioContextConstructor | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      this.ctx = new Ctor();
    } catch {
      return null;
    }
    return this.ctx;
  }

  unlock(): void {
    const ctx = this.ensure();
    if (ctx && ctx.state === "suspended") {
      void ctx.resume();
    }
  }

  private blip(
    frequency: number,
    duration: number,
    peakGain: number,
    type: OscillatorType = "triangle",
  ): void {
    if (!this.enabled) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peakGain, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  /** Ratchet click while the wheel keeps moving; `intensity` fades out on deceleration. */
  tick(intensity = 1): void {
    const clamped = Math.max(0.15, Math.min(1, intensity));
    this.blip(900 + clamped * 700, 0.05, 0.035 * clamped + 0.008, "square");
  }

  chime(): void {
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((frequency, index) => {
      window.setTimeout(() => this.blip(frequency, 0.55, 0.06, "sine"), index * 90);
    });
  }

  select(): void {
    this.blip(660, 0.08, 0.04, "triangle");
  }
}

export const sound = new SoundKit();
