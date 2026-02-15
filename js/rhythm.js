/**
 * Rhythm game: sing the sequence Do->...->Do2->Do2->...->Do, get score %.
 */

const RHYTHM_SEQUENCE = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'Do2', 'Do2', 'A', 'G', 'F', 'E', 'D', 'C'];
const RHYTHM_LABELS = { C: 'До', D: 'Ре', E: 'Ми', F: 'Фа', G: 'Соль', A: 'Ля', B: 'Си', Do2: 'До²' };
const SAMPLE_INTERVAL_MS = 80;
const HIT_RATIO = 0.3;

async function runRhythmGame(options) {
  const { getSungNote, onCountdown, onNoteStart, onNoteEnd, onResult } = options;
  const noteNames = [...new Set(RHYTHM_SEQUENCE)];
  await window.AudioModule.preloadRhythmNotes(noteNames);

  const bpm = 120;
  const countdownBeats = 5;
  const beatMs = (60 / bpm) * 1000;

  await Promise.all([
    window.AudioModule.metronome(countdownBeats, bpm),
    (async () => {
      for (let i = countdownBeats; i >= 1; i--) {
        if (onCountdown) onCountdown(i);
        await new Promise((r) => setTimeout(r, beatMs));
      }
    })()
  ]);

  const results = [];
  const total = RHYTHM_SEQUENCE.length;

  for (let i = 0; i < RHYTHM_SEQUENCE.length; i++) {
    const expectedNote = RHYTHM_SEQUENCE[i];
    if (onNoteStart) onNoteStart(expectedNote, i + 1, total);

    const samples = [];
    const playbackDone = window.AudioModule.playNoteOnce(expectedNote);
    const interval = setInterval(() => {
      samples.push(getSungNote() === expectedNote);
    }, SAMPLE_INTERVAL_MS);

    await playbackDone;
    clearInterval(interval);

    const hits = samples.filter(Boolean).length;
    const hit = samples.length > 0 && hits / samples.length >= HIT_RATIO;
    results.push(hit);
    if (onNoteEnd) onNoteEnd();
  }

  const hitsCount = results.filter(Boolean).length;
  const percent = total ? Math.round((hitsCount / total) * 100) : 0;
  if (onResult) onResult(hitsCount, total, percent);
}

window.RhythmGame = {
  run: runRhythmGame,
  SEQUENCE: RHYTHM_SEQUENCE,
  LABELS: RHYTHM_LABELS
};
