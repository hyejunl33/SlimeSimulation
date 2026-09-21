// Procedural Sound Engine using Web Audio API

let audioCtx: AudioContext | null = null;

export const getAudioCtx = () => {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
};

const createNoiseBuffer = (ctx: AudioContext, duration: number) => {
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
};

// --- WAX BALL (Crunchy, crackling sound) ---
export const playWaxSound = () => {
  const ctx = getAudioCtx();
  if (!ctx) return;
  
  // Create a short crackle by rapidly pulsing noise
  for (let i = 0; i < 3; i++) {
    const osc = ctx.createBufferSource();
    osc.buffer = createNoiseBuffer(ctx, 0.05);
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 4000 + Math.random() * 2000; // very crunchy
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, ctx.currentTime + i * 0.02);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.02 + 0.04);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(ctx.currentTime + i * 0.02);
    osc.stop(ctx.currentTime + i * 0.02 + 0.05);
  }
};

// --- BUTTER BALL (Squelchy, wet stretching sound) ---
export const playButterSound = (pressure: number) => {
  const ctx = getAudioCtx();
  if (!ctx) return;
  
  const osc = ctx.createBufferSource();
  osc.buffer = createNoiseBuffer(ctx, 0.3); // longer stretch sound
  
  // Wet squelch using bandpass envelope
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 15.0; // High resonance for wet sound
  
  // Sweep frequency down to simulate a squelch
  filter.frequency.setValueAtTime(1500 + pressure * 1000, ctx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.15);
  
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.8, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
  
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  
  osc.start(ctx.currentTime);
};

// --- BEAD BALL (Glassy/Plastic rattling sound) ---
export const playBeadSound = (count: number) => {
  const ctx = getAudioCtx();
  if (!ctx) return;
  
  for (let i = 0; i < count; i++) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    // Random high pitch clacks
    osc.frequency.setValueAtTime(4000 + Math.random() * 3000, ctx.currentTime + i * 0.01);
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 5.0;
    filter.frequency.value = 5000;
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.01 + 0.03);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(ctx.currentTime + i * 0.01);
    osc.stop(ctx.currentTime + i * 0.01 + 0.05);
  }
};

export const getSoundForBall = (level: number) => {
  return {
    playTap: () => level === 1 ? playWaxSound() : level === 2 ? playButterSound(0.5) : playBeadSound(3),
    playPress: (pressure: number) => level === 2 ? playButterSound(pressure) : playWaxSound(),
    playCrunch: (amount: number) => playBeadSound(amount),
    playRelease: () => level === 1 ? playWaxSound() : undefined
  };
};
