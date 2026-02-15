/**
 * Piano notes (4th octave) and pitch detection for vocal control.
 */

const NOTE_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NOTE_FREQS = {
  C: 261.63,
  D: 293.66,
  E: 329.63,
  F: 349.23,
  G: 392.00,
  A: 440.00,
  B: 493.88
};

let audioContext = null;
let micStream = null;
let analyser = null;
let micSource = null;
let currentNoteOscillators = [];
let gainNode = null;
let fftSize = 2048;
let scriptProcessor = null;
let dataArray = null;
let bufferLength = 0;

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

function initPiano() {
  const ctx = getAudioContext();
  if (!gainNode) {
    gainNode = ctx.createGain();
    gainNode.gain.value = 0.25;
    gainNode.connect(ctx.destination);
  }
}

function stopCurrentNote() {
  currentNoteOscillators.forEach(o => {
    try {
      o.stop();
      o.disconnect();
    } catch (_) {}
  });
  currentNoteOscillators = [];
}

function playNote(noteName, loop = true) {
  const ctx = getAudioContext();
  const freq = NOTE_FREQS[noteName];
  if (!freq) return;

  stopCurrentNote();
  initPiano();

  // Simple "piano-like" tone: fundamental + weak harmonic
  const osc1 = ctx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.value = freq;
  const g1 = ctx.createGain();
  g1.gain.value = 1;
  osc1.connect(g1);
  g1.connect(gainNode);

  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.value = freq * 2;
  const g2 = ctx.createGain();
  g2.gain.value = 0.2;
  osc2.connect(g2);
  g2.connect(gainNode);

  osc1.start(0);
  osc2.start(0);
  currentNoteOscillators = [osc1, osc2];

  if (!loop) {
    const stopTime = ctx.currentTime + 0.15;
    osc1.stop(stopTime);
    osc2.stop(stopTime);
    currentNoteOscillators = [];
  }
}

function freqToNote(freq) {
  if (!freq || freq < 65 || freq > 1400) return null;
  const A4 = 440;
  const midi = 69 + 12 * Math.log2(freq / A4);
  const noteIndex = Math.round(midi) % 12;
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const name = noteNames[noteIndex];
  if (NOTE_NAMES.includes(name)) return name;
  const sharpToNatural = { 'C#': 'C', 'D#': 'D', 'F#': 'F', 'G#': 'G', 'A#': 'A' };
  return sharpToNatural[name] || null;
}

const VOCAL_FREQ_MIN = 90;
const VOCAL_FREQ_MAX = 650;

function getPeakFrequency() {
  if (!analyser || !dataArray) return null;
  analyser.getByteFrequencyData(dataArray);
  const sampleRate = audioContext.sampleRate;
  const binFreq = sampleRate / fftSize;
  const iMin = Math.max(1, Math.floor(VOCAL_FREQ_MIN / binFreq));
  const iMax = Math.min(bufferLength - 2, Math.ceil(VOCAL_FREQ_MAX / binFreq));
  let maxMag = 0;
  let maxIndex = 0;
  for (let i = iMin; i <= iMax; i++) {
    if (dataArray[i] > maxMag) {
      maxMag = dataArray[i];
      maxIndex = i;
    }
  }
  if (maxMag < 18) return null;
  const l = dataArray[maxIndex - 1] || 0;
  const c = dataArray[maxIndex];
  const r = dataArray[maxIndex + 1] || 0;
  const delta = 0.5 * (l - r) / (l - 2 * c + r);
  const peakIndex = maxIndex + (isFinite(delta) ? delta : 0);
  const freq = (peakIndex * sampleRate) / fftSize;
  return freq;
}

async function initMicrophone(onNoteDetected) {
  const ctx = getAudioContext();
  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        autoGainControl: false,
        noiseSuppression: false
      }
    });
  } catch (_) {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  }
  micSource = ctx.createMediaStreamSource(micStream);
  analyser = ctx.createAnalyser();
  analyser.fftSize = fftSize;
  analyser.smoothingTimeConstant = 0.65;
  analyser.minDecibels = -65;
  analyser.maxDecibels = -5;
  micSource.connect(analyser);
  bufferLength = analyser.frequencyBinCount;
  dataArray = new Uint8Array(bufferLength);

  let lastNote = null;
  let stableCount = 0;
  let silentFrames = 0;
  const SILENT_FRAMES_BEFORE_CLEAR = 8;

  function tick() {
    const freq = getPeakFrequency();
    const note = freq ? freqToNote(freq) : null;
    if (note) {
      silentFrames = 0;
      if (note === lastNote) {
        stableCount++;
        if (stableCount >= 2) onNoteDetected(note);
      } else {
        lastNote = note;
        stableCount = 1;
      }
    } else {
      if (lastNote !== null) {
        silentFrames++;
        if (silentFrames >= SILENT_FRAMES_BEFORE_CLEAR) {
          lastNote = null;
          stableCount = 0;
          onNoteDetected(null);
        }
      } else {
        onNoteDetected(null);
      }
    }
    requestAnimationFrame(tick);
  }
  tick();
}

function stopMicrophone() {
  if (micStream) {
    micStream.getTracks().forEach(t => t.stop());
    micStream = null;
  }
}

window.AudioModule = {
  NOTE_NAMES,
  NOTE_FREQS,
  playNote,
  stopCurrentNote,
  initMicrophone,
  stopMicrophone,
  getAudioContext
};
