/**
 * Entry: menu (platformer / rhythm), mic, game, rhythm game, result.
 */

const el = {
  screenStart: document.getElementById('screen-start'),
  screenCountdown: document.getElementById('screen-countdown'),
  screenRhythm: document.getElementById('screen-rhythm'),
  screenResult: document.getElementById('screen-result'),
  screenGame: document.getElementById('screen-game'),
  btnPlatform: document.getElementById('btn-platform'),
  btnRhythm: document.getElementById('btn-rhythm'),
  btnBack: document.getElementById('btn-back'),
  countdownNum: document.getElementById('countdown-num'),
  rhythmCurrent: document.getElementById('rhythm-current'),
  rhythmProgress: document.getElementById('rhythm-progress'),
  rhythmInstruction: document.getElementById('rhythm-instruction'),
  resultScore: document.getElementById('result-score'),
  resultDetail: document.getElementById('result-detail'),
  currentNote: document.getElementById('current-note'),
  youSing: document.getElementById('you-sing'),
  micIndicator: document.getElementById('mic-indicator')
};

let currentSungNote = null;

function showScreen(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.add('hidden'));
  const screen = document.getElementById(id);
  if (screen) screen.classList.remove('hidden');
}

function setCurrentNoteUI(note) {
  if (!el.currentNote) return;
  if (!note) {
    el.currentNote.textContent = '—';
    el.currentNote.className = 'current-note';
    AudioModule.stopCurrentNote();
    return;
  }
  el.currentNote.textContent = Game.NOTE_LABELS[note] || note;
  el.currentNote.className = 'current-note';
  el.currentNote.style.color = getComputedStyle(document.documentElement).getPropertyValue('--neon-cyan');
  AudioModule.playNote(note, true);
}

function setYouSingUI(note) {
  if (!el.youSing) return;
  const label = note ? (Game.NOTE_LABELS[note] || RhythmGame.LABELS[note] || note) : '—';
  el.youSing.textContent = 'Вы поёте: ' + label;
  el.youSing.classList.toggle('active', !!note);
}

function setMicActive(active) {
  if (el.micIndicator) el.micIndicator.classList.toggle('active', active);
}

async function startPlatformer() {
  try {
    el.btnPlatform.disabled = true;
    el.btnPlatform.textContent = 'Загрузка…';
    const ctx = AudioModule.getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();

    await AudioModule.initMicrophone((detectedNote) => {
      currentSungNote = detectedNote;
      Game.setSungNote(detectedNote);
      setYouSingUI(detectedNote);
      setMicActive(true);
    });
    setMicActive(true);

    Game.start((note) => setCurrentNoteUI(note));

    showScreen('screen-game');
  } catch (err) {
    console.error(err);
    alert('Нужен доступ к микрофону. Разрешите его и обновите страницу.');
  } finally {
    el.btnPlatform.disabled = false;
    el.btnPlatform.textContent = 'Платформер';
  }
}

async function startRhythm() {
  try {
    el.btnRhythm.disabled = true;
    el.btnRhythm.textContent = 'Загрузка…';
    const ctx = AudioModule.getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();

    await AudioModule.initMicrophone((detectedNote) => {
      currentSungNote = detectedNote;
      setYouSingUI(detectedNote);
      setMicActive(true);
    });
    setMicActive(true);

    showScreen('screen-countdown');
    el.countdownNum.textContent = '5';

    await RhythmGame.run({
      getSungNote: () => currentSungNote,
      onCountdown: (n) => {
        if (el.countdownNum) el.countdownNum.textContent = String(n);
      },
      onNoteStart: (noteName, index, total) => {
        showScreen('screen-rhythm');
        if (el.rhythmCurrent) el.rhythmCurrent.textContent = RhythmGame.LABELS[noteName] || noteName;
        if (el.rhythmProgress) el.rhythmProgress.textContent = index + ' / ' + total;
      },
      onNoteEnd: () => {},
      onResult: (hits, total, percent) => {
        showScreen('screen-result');
        if (el.resultScore) el.resultScore.textContent = percent + ' %';
        if (el.resultDetail) el.resultDetail.textContent = hits + ' попаданий из ' + total;
      }
    });
  } catch (err) {
    console.error(err);
    alert('Ошибка: ' + (err.message || 'проверьте микрофон'));
  } finally {
    el.btnRhythm.disabled = false;
    el.btnRhythm.textContent = 'Оценка попадания в ноту';
  }
}

if (el.btnPlatform) {
  el.btnPlatform.addEventListener('click', startPlatformer);
}
if (el.btnRhythm) {
  el.btnRhythm.addEventListener('click', startRhythm);
}
if (el.btnBack) {
  el.btnBack.addEventListener('click', () => showScreen('screen-start'));
}
