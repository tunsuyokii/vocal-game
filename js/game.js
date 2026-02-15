/**
 * 2D platformer: ball moves right, obstacles require singing the correct note to pass.
 */

const CANVAS_W = 800;
const CANVAS_H = 400;
const BALL_R = 18;
const BALL_SPEED = 1.0;
const BALL_VY_SPEED = 0.22;
const FLOOR_Y = CANVAS_H - 40;
const NOTE_ORDER = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NOTE_ZONE_TOP = 70;
const NOTE_ZONE_BOTTOM = FLOOR_Y - 25;
const LANE_COUNT = NOTE_ORDER.length;
const LANE_HEIGHT = (NOTE_ZONE_BOTTOM - NOTE_ZONE_TOP) / LANE_COUNT;
const GAP_HEIGHT = LANE_HEIGHT * 1.15;

const NOTE_COLORS = {
  C: '#00f5ff',
  D: '#ff00aa',
  E: '#39ff14',
  F: '#ffff00',
  G: '#ff6600',
  A: '#ff3366',
  B: '#bf00ff'
};

const NOTE_GLOW = {
  C: '0 0 20px #00f5ff, 0 0 40px #00f5ff80',
  D: '0 0 20px #ff00aa, 0 0 40px #ff00aa80',
  E: '0 0 20px #39ff14, 0 0 40px #39ff1480',
  F: '0 0 20px #ffff00, 0 0 40px #ffff0080',
  G: '0 0 20px #ff6600, 0 0 40px #ff660080',
  A: '0 0 20px #ff3366, 0 0 40px #ff336680',
  B: '0 0 20px #bf00ff, 0 0 40px #bf00ff80'
};

const NOTE_LABELS = { C: 'До', D: 'Ре', E: 'Ми', F: 'Фа', G: 'Соль', A: 'Ля', B: 'Си' };

function getLaneYCenter(note) {
  const i = NOTE_ORDER.indexOf(note);
  if (i < 0) return (NOTE_ZONE_TOP + NOTE_ZONE_BOTTOM) / 2;
  return NOTE_ZONE_BOTTOM - (i + 0.5) * LANE_HEIGHT;
}

function getLaneGapBounds(note) {
  const center = getLaneYCenter(note);
  const half = GAP_HEIGHT / 2;
  return { yMin: center - half, yMax: center + half };
}

function createLevel() {
  const obstacles = [];
  const notes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const spacing = 110;
  const startX = 200;
  const wallW = 18;
  const NOTE_SWITCH_MARGIN = 55;

  notes.forEach((note, i) => {
    obstacles.push({
      x: startX + i * spacing,
      w: wallW,
      note
    });
  });

  return {
    obstacles,
    endX: startX + notes.length * spacing + 80
  };
}

let canvas, ctx;
let ball = { x: 80, y: FLOOR_Y - BALL_R, vx: 0, vy: 0 };
let level = null;
let currentObstacleNote = null;
let sungNote = null;
let animId = null;
let onNoteChangeCallback = null;

function getObstacleAt(x) {
  if (!level) return null;
  for (const o of level.obstacles) {
    if (x + BALL_R > o.x && x - BALL_R < o.x + o.w) return o;
  }
  return null;
}

function getNextObstacleNote(ballX) {
  if (!level) return null;
  const margin = 55;
  for (const o of level.obstacles) {
    if (ballX + BALL_R < o.x) return o.note;
    if (ballX <= o.x + o.w + margin) return o.note;
  }
  return null;
}

function drawBall() {
  const { x, y } = ball;
  ctx.save();
  ctx.shadowColor = '#00f5ff';
  ctx.shadowBlur = 25;
  const gradient = ctx.createRadialGradient(x - 5, y - 5, 0, x, y, BALL_R);
  gradient.addColorStop(0, '#88ffff');
  gradient.addColorStop(0.6, '#00f5ff');
  gradient.addColorStop(1, '#006666');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, BALL_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawObstacle(o) {
  const c = NOTE_COLORS[o.note] || '#fff';
  const { yMin: gapYMin, yMax: gapYMax } = getLaneGapBounds(o.note);
  ctx.save();
  ctx.shadowBlur = 25;
  ctx.shadowColor = c;
  ctx.fillStyle = c;
  ctx.globalAlpha = 0.9;
  if (gapYMin - NOTE_ZONE_TOP > 2) {
    ctx.fillRect(o.x, NOTE_ZONE_TOP, o.w, gapYMin - NOTE_ZONE_TOP);
  }
  if (NOTE_ZONE_BOTTOM - gapYMax > 2) {
    ctx.fillRect(o.x, gapYMax, o.w, NOTE_ZONE_BOTTOM - gapYMax);
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 2;
  ctx.strokeRect(o.x, NOTE_ZONE_TOP, o.w, gapYMin - NOTE_ZONE_TOP);
  ctx.strokeRect(o.x, gapYMax, o.w, NOTE_ZONE_BOTTOM - gapYMax);
  ctx.restore();

  const centerY = getLaneYCenter(o.note);
  ctx.save();
  ctx.fillStyle = '#0a0a0f';
  ctx.font = 'bold 12px JetBrains Mono';
  ctx.textAlign = 'center';
  ctx.translate(o.x + o.w / 2, centerY);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(NOTE_LABELS[o.note], 0, 4);
  ctx.restore();
}

function drawNoteLanes() {
  ctx.save();
  ctx.strokeStyle = 'rgba(0,245,255,0.12)';
  ctx.lineWidth = 1;
  for (let i = 1; i < LANE_COUNT; i++) {
    const y = NOTE_ZONE_TOP + i * LANE_HEIGHT;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CANVAS_W, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFloor() {
  const y = FLOOR_Y;
  ctx.save();
  const g = ctx.createLinearGradient(0, y - 20, 0, CANVAS_H);
  g.addColorStop(0, 'rgba(0,245,255,0.15)');
  g.addColorStop(0.5, 'rgba(0,245,255,0.05)');
  g.addColorStop(1, 'transparent');
  ctx.fillStyle = g;
  ctx.fillRect(0, y - 20, CANVAS_W, CANVAS_H - y + 20);
  ctx.strokeStyle = 'rgba(0,245,255,0.6)';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#00f5ff';
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(CANVAS_W, y);
  ctx.stroke();
  ctx.restore();
}

function draw() {
  ctx.fillStyle = '#0a0a0f';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  drawNoteLanes();
  level.obstacles.forEach(drawObstacle);
  drawFloor();
  drawBall();
}

const BALL_Y_MIN = NOTE_ZONE_TOP + BALL_R;
const BALL_Y_MAX = NOTE_ZONE_BOTTOM - BALL_R;

function update(dt) {
  const prevX = ball.x;

  const targetY = sungNote ? getLaneYCenter(sungNote) : ball.y;
  const dy = targetY - ball.y;
  const step = BALL_VY_SPEED * dt;
  if (Math.abs(dy) <= step) {
    ball.y = targetY;
  } else {
    ball.y += Math.sign(dy) * step;
  }
  ball.y = Math.max(BALL_Y_MIN, Math.min(BALL_Y_MAX, ball.y));

  ball.x += ball.vx * dt;

  const obstacle = getObstacleAt(ball.x);
  if (obstacle) {
    const correctNote = obstacle.note;
    const gap = getLaneGapBounds(correctNote);
    const ballInGap = ball.y >= gap.yMin - BALL_R * 0.3 && ball.y <= gap.yMax + BALL_R * 0.3;
    const singingCorrect = sungNote === correctNote;
    if (!singingCorrect || !ballInGap) {
      ball.x = prevX;
      ball.vx = 0;
    } else {
      ball.vx = BALL_SPEED;
    }
  } else {
    ball.vx = BALL_SPEED;
  }

  const nextNote = getNextObstacleNote(ball.x);
  if (nextNote !== currentObstacleNote) {
    currentObstacleNote = nextNote;
    if (typeof onNoteChangeCallback === 'function') onNoteChangeCallback(nextNote);
  }
}

function gameLoop(t) {
  const dt = Math.min(16, t - (gameLoop.lastT || t));
  gameLoop.lastT = t;
  update(dt);
  draw();
  animId = requestAnimationFrame(gameLoop);
}

function startGame(onCurrentNoteChange) {
  onNoteChangeCallback = onCurrentNoteChange;
  level = createLevel();
  const startY = getLaneYCenter('F');
  ball = { x: 80, y: startY, vx: BALL_SPEED, vy: 0 };
  sungNote = null;
  currentObstacleNote = level.obstacles[0].note;
  if (typeof onCurrentNoteChange === 'function') onCurrentNoteChange(currentObstacleNote);

  if (!canvas) {
    canvas = document.getElementById('game-canvas');
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    ctx = canvas.getContext('2d');
  }

  if (animId) cancelAnimationFrame(animId);
  gameLoop.lastT = performance.now();
  animId = requestAnimationFrame(gameLoop);
}

function setSungNote(note) {
  sungNote = note;
}

function setCurrentObstacleNote(note) {
  currentObstacleNote = note;
}

function getCurrentObstacleNote() {
  return currentObstacleNote;
}

function stopGame() {
  if (animId) {
    cancelAnimationFrame(animId);
    animId = null;
  }
}

window.Game = {
  start: startGame,
  stop: stopGame,
  setSungNote,
  setCurrentObstacleNote,
  getCurrentObstacleNote,
  NOTE_LABELS
};
