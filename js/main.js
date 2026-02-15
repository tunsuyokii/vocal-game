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
  rhythmTrack: document.getElementById('rhythm-track'),
  rhythmCurrent: document.getElementById('rhythm-current'),
  rhythmNext: document.getElementById('rhythm-next'),
  rhythmProgress: document.getElementById('rhythm-progress'),
  rhythmInstruction: document.getElementById('rhythm-instruction'),
  resultScore: document.getElementById('result-score'),
  resultDetail: document.getElementById('result-detail'),
  resultHold: document.getElementById('result-hold'),
  resultErrorsWrap: document.getElementById('result-errors-wrap'),
  resultErrorsList: document.getElementById('result-errors-list'),
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
  el.currentNote.style.color = getComputedStyle(document.documentElement).getPropertyValue('--accent');
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

function buildRhythmTrack() {
  if (!el.rhythmTrack) return;
  el.rhythmTrack.innerHTML = '';
  RhythmGame.SEQUENCE.forEach((noteName, i) => {
    const cell = document.createElement('div');
    cell.className = 'rhythm-note';
    cell.dataset.index = String(i);
    cell.textContent = RhythmGame.LABELS[noteName] || noteName;
    el.rhythmTrack.appendChild(cell);
  });
}

function setRhythmTrackCurrent(index) {
  if (!el.rhythmTrack) return;
  el.rhythmTrack.querySelectorAll('.rhythm-note').forEach((c, i) => {
    c.classList.toggle('current', i === index);
    c.classList.toggle('next', i === index + 1);
  });
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

    buildRhythmTrack();
    showScreen('screen-countdown');
    if (el.countdownNum) el.countdownNum.textContent = '5';

    await RhythmGame.run({
      getSungNote: () => currentSungNote,
      onCountdown: (n) => {
        if (el.countdownNum) el.countdownNum.textContent = String(n);
      },
      onNoteStart: (noteName, index, total) => {
        showScreen('screen-rhythm');
        if (el.rhythmCurrent) el.rhythmCurrent.textContent = RhythmGame.LABELS[noteName] || noteName;
        const nextName = RhythmGame.SEQUENCE[index + 1];
        if (el.rhythmNext) el.rhythmNext.textContent = nextName ? RhythmGame.LABELS[nextName] || nextName : '—';
        if (el.rhythmProgress) el.rhythmProgress.textContent = (index + 1) + ' / ' + total;
        setRhythmTrackCurrent(index);
      },
      onNoteEnd: () => {},
      onResult: (data) => {
        showScreen('screen-result');
        if (el.resultScore) el.resultScore.textContent = data.percent + ' %';
        if (el.resultDetail) el.resultDetail.textContent = data.hitsCount + ' попаданий из ' + data.total;
        if (el.resultHold) el.resultHold.textContent = 'Удержание ноты: ' + data.holdPercent + ' %';
        if (el.resultErrorsList) {
          el.resultErrorsList.innerHTML = '';
          if (data.errors && data.errors.length > 0) {
            data.errors.forEach((e) => {
              const li = document.createElement('li');
              const expectedLabel = RhythmGame.LABELS[e.expected] || e.expected;
              const sungLabel = e.sung ? (RhythmGame.LABELS[e.sung] || e.sung) : '—';
              if (e.expected === e.sung) {
                li.textContent = 'Нота ' + expectedLabel + ' — слабое удержание (' + Math.round(e.holdRatio * 100) + '%)';
              } else {
                li.textContent = 'Нота ' + expectedLabel + ' → спели ' + sungLabel;
              }
              el.resultErrorsList.appendChild(li);
            });
          }
        }
        if (el.resultErrorsWrap) {
          el.resultErrorsWrap.style.display = data.errors && data.errors.length > 0 ? 'block' : 'none';
        }
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

if (el.btnPlatform) el.btnPlatform.addEventListener('click', startPlatformer);
if (el.btnRhythm) el.btnRhythm.addEventListener('click', startRhythm);
if (el.btnBack) el.btnBack.addEventListener('click', () => showScreen('screen-start'));
