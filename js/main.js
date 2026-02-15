/**
 * Entry: start screen, mic, game, HUD, piano note playback.
 */

const el = {
  screenStart: document.getElementById('screen-start'),
  screenGame: document.getElementById('screen-game'),
  btnStart: document.getElementById('btn-start'),
  currentNote: document.getElementById('current-note'),
  youSing: document.getElementById('you-sing'),
  micIndicator: document.getElementById('mic-indicator')
};

function setCurrentNoteUI(note) {
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
  const label = note ? Game.NOTE_LABELS[note] || note : '—';
  el.youSing.textContent = 'Вы поёте: ' + label;
  el.youSing.classList.toggle('active', !!note);
}

function setMicActive(active) {
  el.micIndicator.classList.toggle('active', active);
}

el.btnStart.addEventListener('click', async () => {
  try {
    el.btnStart.disabled = true;
    el.btnStart.textContent = 'Загрузка…';
    const ctx = AudioModule.getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();

    await AudioModule.initMicrophone((detectedNote) => {
      Game.setSungNote(detectedNote);
      setYouSingUI(detectedNote);
      setMicActive(true);
    });
    setMicActive(true);

    Game.start((note) => {
      setCurrentNoteUI(note);
    });

    el.screenStart.classList.add('hidden');
    el.screenGame.classList.remove('hidden');
  } catch (err) {
    console.error(err);
    alert('Нужен доступ к микрофону. Разрешите его и обновите страницу.');
    el.btnStart.disabled = false;
    el.btnStart.textContent = 'Начать игру';
  }
});
