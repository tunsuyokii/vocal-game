/**
 * Rhythm game: sing the sequence Do->...->Do2->Do2->...->Do, get score % and per-note details.
 */

const RHYTHM_SEQUENCE = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'Do2', 'Do2', 'B', 'A', 'G', 'F', 'E', 'D', 'C'];
const RHYTHM_LABELS = { C: 'До', D: 'Ре', E: 'Ми', F: 'Фа', G: 'Соль', A: 'Ля', B: 'Си', Do2: 'До²' };
const SAMPLE_INTERVAL_MS = 80;
const HIT_RATIO = 0.3;

function mostFrequent(arr) {
  const counts = {};
  let max = 0;
  let out = null;
  for (const v of arr) {
    if (v == null) continue;
    counts[v] = (counts[v] || 0) + 1;
    if (counts[v] > max) {
      max = counts[v];
      out = v;
    }
  }
  return out;
}

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

  const noteDetails = [];
  const total = RHYTHM_SEQUENCE.length;

  for (let i = 0; i < RHYTHM_SEQUENCE.length; i++) {
    const expectedNote = RHYTHM_SEQUENCE[i];
    if (onNoteStart) onNoteStart(expectedNote, i, total);

    const samples = [];
    const playbackDone = window.AudioModule.playNoteOnce(expectedNote);
    const interval = setInterval(() => {
      samples.push(getSungNote());
    }, SAMPLE_INTERVAL_MS);

    await playbackDone;
    clearInterval(interval);

    const hits = samples.filter((s) => s === expectedNote).length;
    const holdRatio = samples.length > 0 ? hits / samples.length : 0;
    const hit = samples.length > 0 && holdRatio >= HIT_RATIO;
    const sungNote = mostFrequent(samples) || null;
    noteDetails.push({
      index: i + 1,
      expected: expectedNote,
      sung: sungNote,
      hit,
      holdRatio
    });
    if (onNoteEnd) onNoteEnd();
  }

  const hitsCount = noteDetails.filter((d) => d.hit).length;
  const percent = total ? Math.round((hitsCount / total) * 100) : 0;
  const avgHold =
    noteDetails.length > 0
      ? noteDetails.reduce((a, d) => a + d.holdRatio, 0) / noteDetails.length
      : 0;
  const holdPercent = Math.round(avgHold * 100);
  const errors = noteDetails.filter((d) => !d.hit);

  if (onResult) onResult({ hitsCount, total, percent, noteDetails, errors, holdPercent });
}

window.RhythmGame = {
  run: runRhythmGame,
  SEQUENCE: RHYTHM_SEQUENCE,
  LABELS: RHYTHM_LABELS
};
