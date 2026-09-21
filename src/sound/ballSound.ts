let audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function createNoiseBuffer(duration: number): AudioBuffer {
  const ctx = getAudioCtx();
  const size = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < size; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

export const waxSound = {
  playTap() {
    try {
      const ctx = getAudioCtx();
      const now = ctx.currentTime;
      const noise = ctx.createBufferSource();
      noise.buffer = createNoiseBuffer(0.12);

      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(2800, now);
      filter.frequency.exponentialRampToValueAtTime(8000, now + 0.04);
      filter.Q.value = 2;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0, now);
      gain.gain.linearRampToValueAtTime(0.9, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(now);
      noise.stop(now + 0.12);
    } catch (e) {}
  },
  playRelease() {
    this.playTap();
  }
};

export const butterSound = {
  playPress(pressure = 0.5) {
    try {
      const ctx = getAudioCtx();
      const now = ctx.currentTime;
      const duration = 0.3 + pressure * 0.2;

      const noise = ctx.createBufferSource();
      noise.buffer = createNoiseBuffer(duration);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, now);
      filter.frequency.exponentialRampToValueAtTime(80, now + duration * 0.8);
      filter.Q.value = 8;

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.0, now);
      noiseGain.gain.linearRampToValueAtTime(0.4 * pressure, now + 0.015);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);

      noise.start(now);
      noise.stop(now + duration);
    } catch (e) {}
  },
  playRelease() {
    this.playPress(0.3);
  }
};

export const beadSound = {
  playCrunch(count = 5) {
    for (let i = 0; i < count; i++) {
      setTimeout(() => this._playOneBead(), Math.random() * 60);
    }
  },
  _playOneBead() {
    try {
      const ctx = getAudioCtx();
      const now = ctx.currentTime;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 700 + Math.random() * 1400;
      filter.Q.value = 12;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0, now);
      gain.gain.linearRampToValueAtTime(0.28, now + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      const noise = ctx.createBufferSource();
      noise.buffer = createNoiseBuffer(0.1);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(now);
      noise.stop(now + 0.1);
    } catch (e) {}
  },
  playRelease() {
    this.playCrunch(3);
  }
};

export function getSoundForBall(level: number) {
  if (level === 1) return waxSound;
  if (level === 2) return butterSound;
  return beadSound;
}
