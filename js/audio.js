/**
 * Piano notes from MP3 (loop until next note) and pitch detection for vocal control.
 */

const NOTE_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'Do2'];
const NOTE_FREQS = {
  C: 261.63,
  D: 293.66,
  E: 329.63,
  F: 349.23,
  G: 392.00,
  A: 440.00,
  B: 493.88,
  Do2: 523.25
};

const NOTE_FILE_NAMES = {
  C: ['C', 'До'],
  D: ['D', 'Ре'],
  E: ['E', 'Ми'],
  F: ['F', 'Фа'],
  G: ['G', 'Соль'],
  A: ['A', 'Ля'],
  B: ['B', 'Си'],
  Do2: ['Do2', 'C2']
};

const NOTES_BASE = 'sounds/notes/';

let audioContext = null;
let micStream = null;
let analyser = null;
let micSource = null;
let currentNoteSource = null;
let gainNode = null;
const MASTER_GAIN = 5.0;
let noteBuffers = {};
let fftSize = 2048;
let dataArray = null;
let bufferLength = 0;

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

function ensureGain() {
  const ctx = getAudioContext();
  if (!gainNode) {
    gainNode = ctx.createGain();
    gainNode.gain.value = MASTER_GAIN;
    gainNode.connect(ctx.destination);
  }
}

function stopCurrentNote() {
  if (currentNoteSource) {
    try {
      currentNoteSource.stop();
      currentNoteSource.disconnect();
    } catch (_) {}
    currentNoteSource = null;
  }
}

function playBuffer(buffer) {
  const ctx = getAudioContext();
  ensureGain();
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const g = ctx.createGain();
  g.gain.value = 2.0;
  source.connect(g);
  g.connect(gainNode);
  source.start(0);
  currentNoteSource = source;
}

function loadNoteBuffer(noteName) {
  const ctx = getAudioContext();
  const tries = NOTE_FILE_NAMES[noteName];
  if (!tries) return Promise.resolve(null);

  function tryLoad(index) {
    if (index >= tries.length) return Promise.resolve(null);
    const name = tries[index];
    const url = NOTES_BASE + encodeURIComponent(name) + '.mp3';
    return fetch(url)
      .then(r => (r.ok ? r.arrayBuffer() : Promise.reject()))
      .then(ab => ctx.decodeAudioData(ab))
      .catch(() => tryLoad(index + 1));
  }

  return tryLoad(0);
}

function playNoteOscillator(noteName) {
  const ctx = getAudioContext();
  const freq = NOTE_FREQS[noteName];
  if (!freq) return;
  ensureGain();
  const osc1 = ctx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.value = freq;
  const g1 = ctx.createGain();
  g1.gain.value = 1;
  osc1.connect(g1);
  g1.connect(gainNode);
  osc1.start(0);
  currentNoteSource = osc1;
}

function getNoteDuration(noteName) {
  const buf = noteBuffers[noteName];
  return buf ? buf.duration : 0;
}

function playNoteOnce(noteName) {
  return new Promise((resolve) => {
    stopCurrentNote();
    ensureGain();
    function playBuf(buffer) {
      const ctx = getAudioContext();
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = false;
      source.onended = () => resolve(buffer.duration);
      const g = ctx.createGain();
      g.gain.value = 2.0;
      source.connect(g);
      g.connect(gainNode);
      source.start(0);
      currentNoteSource = source;
    }
    if (noteBuffers[noteName]) {
      playBuf(noteBuffers[noteName]);
      return;
    }
    loadNoteBuffer(noteName).then((buffer) => {
      if (buffer) {
        noteBuffers[noteName] = buffer;
        playBuf(buffer);
      } else {
        resolve(1);
      }
    });
  });
}

function playNote(noteName, loop = true) {
  if (!NOTE_NAMES.includes(noteName)) return;
  stopCurrentNote();
  ensureGain();

  if (noteBuffers[noteName]) {
    playBuffer(noteBuffers[noteName]);
    return;
  }
  loadNoteBuffer(noteName).then((buffer) => {
    if (buffer) {
      noteBuffers[noteName] = buffer;
      playBuffer(buffer);
    } else {
      playNoteOscillator(noteName);
    }
  });
}

const C_DO2_FREQ_THRESHOLD = 400;

function freqToNote(freq) {
  if (!freq || freq < 65 || freq > 1400) return null;
  const A4 = 440;
  const midi = 69 + 12 * Math.log2(freq / A4);
  const noteIndex = Math.round(midi) % 12;
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const name = noteNames[noteIndex];
  if (name === 'C') return freq >= C_DO2_FREQ_THRESHOLD ? 'Do2' : 'C';
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
  let freq = (peakIndex * sampleRate) / fftSize;
  if (freq > 380) {
    const fundBin = (freq / 2) * fftSize / sampleRate;
    const iFund = Math.round(fundBin);
    if (iFund >= 1 && iFund < bufferLength) {
      const magFund = dataArray[iFund] || 0;
      if (magFund >= maxMag * 0.35) freq = freq / 2;
    }
  }
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

function metronome(beats, bpm) {
  const ctx = getAudioContext();
  ensureGain();
  const intervalMs = (60 / bpm) * 1000;
  return new Promise((resolve) => {
    let count = 0;
    function tick() {
      if (count >= beats) {
        resolve();
        return;
      }
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 440;
      const g = ctx.createGain();
      g.gain.value = 0.5;
      osc.connect(g);
      g.connect(gainNode);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.08);
      count++;
      setTimeout(tick, intervalMs);
    }
    tick();
  });
}

async function preloadRhythmNotes(noteNames) {
  for (const name of noteNames) {
    if (noteBuffers[name]) continue;
    const buf = await loadNoteBuffer(name);
    if (buf) noteBuffers[name] = buf;
  }
}

window.AudioModule = {
  NOTE_NAMES,
  NOTE_FREQS,
  playNote,
  playNoteOnce,
  stopCurrentNote,
  getNoteDuration,
  initMicrophone,
  stopMicrophone,
  getAudioContext,
  metronome,
  preloadRhythmNotes
};
