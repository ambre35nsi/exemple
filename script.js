const BASE_MAP = [
  "###############",
  "#P....#...#...#",
  "#.###.#.#.#.#.#",
  "#.....#.#...#.#",
  "#.#####.#####.#",
  "#.............#",
  "###.#.#####.#.#",
  "#...#...G...#.#",
  "#.###.#.#.###.#",
  "#.....#.#.....#",
  "#.###########.#",
  "#.............#",
  "#.###.###.###.#",
  "#...#.....#...#",
  "###############"
];

const TILE = {
  WALL: "#",
  PELLET: ".",
  EMPTY: " "
};

const DIRECTIONS = {
  ArrowUp: { row: -1, col: 0 },
  ArrowDown: { row: 1, col: 0 },
  ArrowLeft: { row: 0, col: -1 },
  ArrowRight: { row: 0, col: 1 }
};

const GAME_SPEED_MS = 180;
const GHOST_SPEED_TURNS = 3;

const canvas = document.getElementById("game-canvas");
const context = canvas.getContext("2d");
const startButton = document.getElementById("start-button");
const startButtonMobile = document.getElementById("start-button-mobile");
const restartButton = document.getElementById("restart-button");
const soundButton = document.getElementById("sound-button");
const scoreValue = document.getElementById("score-value");
const pelletValue = document.getElementById("pellet-value");
const stateValue = document.getElementById("state-value");
const message = document.getElementById("message");
const mobileStartSlot = document.getElementById("mobile-start-slot");
const touchJoystick = document.getElementById("touch-joystick");
const joystickBase = document.getElementById("joystick-base");
const joystickThumb = document.getElementById("joystick-thumb");

const SMARTPHONE_MEDIA_QUERY = "(max-width: 768px) and (pointer: coarse)";
const joystickState = {
  activePointerId: null,
  centerX: 0,
  centerY: 0,
  maxDistance: 0,
  deadZone: 0
};

const gameState = {
  grid: [],
  rows: BASE_MAP.length,
  cols: BASE_MAP[0].length,
  pacman: { row: 1, col: 1 },
  ghost: { row: 7, col: 7 },
  queuedDirection: null,
  currentDirection: null,
  score: 0,
  pelletsLeft: 0,
  started: false,
  finished: false,
  soundEnabled: true,
  tickCount: 0,
  loopId: null
};

function setupGame() {
  gameState.grid = [];
  gameState.score = 0;
  gameState.pelletsLeft = 0;
  gameState.started = false;
  gameState.finished = false;
  gameState.tickCount = 0;
  gameState.queuedDirection = null;
  gameState.currentDirection = null;

  BASE_MAP.forEach((line, rowIndex) => {
    const row = [];

    for (let colIndex = 0; colIndex < line.length; colIndex += 1) {
      const cell = line[colIndex];

      if (cell === "P") {
        gameState.pacman = { row: rowIndex, col: colIndex };
        row.push(TILE.EMPTY);
        continue;
      }

      if (cell === "G") {
        gameState.ghost = { row: rowIndex, col: colIndex };
        row.push(TILE.EMPTY);
        continue;
      }

      if (cell === TILE.PELLET) {
        gameState.pelletsLeft += 1;
      }

      row.push(cell);
    }

    gameState.grid.push(row);
  });

  updateStatus();
  setMessage("Clique sur Lancer pour commencer la partie.");
  renderGame();
  updateMobileControlsVisibility();
}

function startGame() {
  if (gameState.finished) {
    setupGame();
  }

  if (gameState.started) {
    return;
  }

  gameState.started = true;
  gameState.loopId = window.setInterval(gameLoop, GAME_SPEED_MS);
  setStateLabel("En cours");
  setMessage("La partie est lancée. Mange toutes les pastilles.");
  updateMobileControlsVisibility();
}

function restartGame() {
  stopLoop();
  setupGame();
}

function stopLoop() {
  if (gameState.loopId !== null) {
    window.clearInterval(gameState.loopId);
    gameState.loopId = null;
  }

  gameState.started = false;
}

function gameLoop() {
  if (gameState.finished) {
    return;
  }

  gameState.tickCount += 1;
  movePacman();

  if (!gameState.finished && gameState.tickCount % GHOST_SPEED_TURNS === 0) {
    moveGhost();
  }

  checkCollision();
  renderGame();
  updateStatus();
}

function movePacman() {
  const nextDirection = chooseDirection();

  if (!nextDirection) {
    return;
  }

  const target = {
    row: gameState.pacman.row + nextDirection.row,
    col: gameState.pacman.col + nextDirection.col
  };

  if (!isWalkable(target.row, target.col)) {
    return;
  }

  gameState.pacman = target;
  gameState.currentDirection = nextDirection;
  collectPellet(target.row, target.col);
}

function chooseDirection() {
  if (gameState.queuedDirection && canMove(gameState.pacman, gameState.queuedDirection)) {
    return gameState.queuedDirection;
  }

  if (gameState.currentDirection && canMove(gameState.pacman, gameState.currentDirection)) {
    return gameState.currentDirection;
  }

  return null;
}

function canMove(origin, direction) {
  const targetRow = origin.row + direction.row;
  const targetCol = origin.col + direction.col;
  return isWalkable(targetRow, targetCol);
}

function collectPellet(row, col) {
  if (gameState.grid[row][col] !== TILE.PELLET) {
    return;
  }

  gameState.grid[row][col] = TILE.EMPTY;
  gameState.score += 10;
  gameState.pelletsLeft -= 1;
  playTone(620, 0.05);

  if (gameState.pelletsLeft === 0) {
    finishGame(true);
  }
}

function moveGhost() {
  const path = findShortestPath(gameState.ghost, gameState.pacman);

  if (path.length > 1) {
    gameState.ghost = path[1];
  }
}

function findShortestPath(start, goal) {
  const queue = [start];
  const visited = new Set([toKey(start.row, start.col)]);
  const previous = new Map();

  while (queue.length > 0) {
    const current = queue.shift();

    if (current.row === goal.row && current.col === goal.col) {
      return buildPath(previous, current);
    }

    Object.values(DIRECTIONS).forEach((direction) => {
      const next = {
        row: current.row + direction.row,
        col: current.col + direction.col
      };
      const nextKey = toKey(next.row, next.col);

      if (!isWalkable(next.row, next.col) || visited.has(nextKey)) {
        return;
      }

      visited.add(nextKey);
      previous.set(nextKey, current);
      queue.push(next);
    });
  }

  return [start];
}

function buildPath(previous, endNode) {
  const path = [endNode];
  let currentKey = toKey(endNode.row, endNode.col);

  while (previous.has(currentKey)) {
    const previousNode = previous.get(currentKey);
    path.unshift(previousNode);
    currentKey = toKey(previousNode.row, previousNode.col);
  }

  return path;
}

function checkCollision() {
  if (
    gameState.pacman.row === gameState.ghost.row &&
    gameState.pacman.col === gameState.ghost.col
  ) {
    finishGame(false);
  }
}

function finishGame(playerWon) {
  gameState.finished = true;
  stopLoop();
  updateMobileControlsVisibility();

  if (playerWon) {
    setStateLabel("Victoire");
    setMessage("Bravo, tu as mangé toutes les pastilles.");
    playTone(880, 0.16);
  } else {
    setStateLabel("Défaite");
    setMessage("Le fantôme t’a attrapé. Clique sur Recommencer.");
    playTone(180, 0.25);
  }
}

function isWalkable(row, col) {
  if (row < 0 || col < 0 || row >= gameState.rows || col >= gameState.cols) {
    return false;
  }

  return gameState.grid[row][col] !== TILE.WALL;
}

function toKey(row, col) {
  return `${row},${col}`;
}

function updateStatus() {
  scoreValue.textContent = String(gameState.score);
  pelletValue.textContent = String(gameState.pelletsLeft);

  if (!gameState.started && !gameState.finished) {
    setStateLabel("En attente");
  }
}

function setStateLabel(text) {
  stateValue.textContent = text;
}

function setMessage(text) {
  message.textContent = text;
}

function renderGame() {
  resizeCanvas();
  const cellSize = canvas.width / gameState.cols;

  context.clearRect(0, 0, canvas.width, canvas.height);

  for (let row = 0; row < gameState.rows; row += 1) {
    for (let col = 0; col < gameState.cols; col += 1) {
      drawCell(row, col, cellSize);
    }
  }

  drawPacman(cellSize);
  drawGhost(cellSize);
}

function resizeCanvas() {
  const size = Math.min(canvas.clientWidth, window.innerHeight * 0.72);
  const safeSize = Math.max(280, Math.floor(size));

  if (canvas.width !== safeSize || canvas.height !== safeSize) {
    canvas.width = safeSize;
    canvas.height = safeSize;
  }
}

function drawCell(row, col, cellSize) {
  const x = col * cellSize;
  const y = row * cellSize;
  const cell = gameState.grid[row][col];

  context.strokeStyle = "rgba(217, 205, 189, 0.08)";
  context.strokeRect(x, y, cellSize, cellSize);

  if (cell === TILE.WALL) {
    context.fillStyle = "#274c77";
    context.fillRect(x, y, cellSize, cellSize);
    context.fillStyle = "rgba(255, 255, 255, 0.1)";
    context.fillRect(x + cellSize * 0.12, y + cellSize * 0.12, cellSize * 0.76, cellSize * 0.22);
    return;
  }

  if (cell === TILE.PELLET) {
    context.fillStyle = "#ffe08a";
    context.beginPath();
    context.arc(x + cellSize / 2, y + cellSize / 2, cellSize * 0.09, 0, Math.PI * 2);
    context.fill();
  }
}

function drawPacman(cellSize) {
  const centerX = gameState.pacman.col * cellSize + cellSize / 2;
  const centerY = gameState.pacman.row * cellSize + cellSize / 2;
  const radius = cellSize * 0.38;
  const mouth = gameState.started ? Math.PI / 5 : Math.PI / 8;

  context.fillStyle = "#f2d14c";
  context.beginPath();
  context.moveTo(centerX, centerY);
  context.arc(centerX, centerY, radius, mouth, Math.PI * 2 - mouth);
  context.closePath();
  context.fill();

  context.fillStyle = "#1f1c18";
  context.beginPath();
  context.arc(centerX + radius * 0.18, centerY - radius * 0.4, radius * 0.12, 0, Math.PI * 2);
  context.fill();
}

function drawGhost(cellSize) {
  const x = gameState.ghost.col * cellSize;
  const y = gameState.ghost.row * cellSize;
  const width = cellSize;
  const height = cellSize;

  context.fillStyle = "#d1495b";
  context.beginPath();
  context.moveTo(x + width * 0.15, y + height * 0.9);
  context.lineTo(x + width * 0.15, y + height * 0.45);
  context.arc(x + width * 0.5, y + height * 0.45, width * 0.35, Math.PI, 0);
  context.lineTo(x + width * 0.85, y + height * 0.9);
  context.lineTo(x + width * 0.7, y + height * 0.78);
  context.lineTo(x + width * 0.5, y + height * 0.9);
  context.lineTo(x + width * 0.3, y + height * 0.78);
  context.closePath();
  context.fill();

  context.fillStyle = "white";
  context.beginPath();
  context.arc(x + width * 0.38, y + height * 0.48, width * 0.1, 0, Math.PI * 2);
  context.arc(x + width * 0.62, y + height * 0.48, width * 0.1, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#1f1c18";
  context.beginPath();
  context.arc(x + width * 0.4, y + height * 0.5, width * 0.04, 0, Math.PI * 2);
  context.arc(x + width * 0.64, y + height * 0.5, width * 0.04, 0, Math.PI * 2);
  context.fill();
}

function toggleSound() {
  gameState.soundEnabled = !gameState.soundEnabled;
  soundButton.textContent = gameState.soundEnabled ? "Son : activé" : "Son : coupé";
  soundButton.setAttribute("aria-pressed", String(gameState.soundEnabled));
}

function playTone(frequency, duration) {
  if (!gameState.soundEnabled) {
    return;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {
    return;
  }

  if (!playTone.audioContext) {
    playTone.audioContext = new AudioContextClass();
  }

  const audioContext = playTone.audioContext;
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.frequency.value = frequency;
  oscillator.type = "square";
  gainNode.gain.value = 0.03;

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

function handleKeydown(event) {
  if (!Object.prototype.hasOwnProperty.call(DIRECTIONS, event.key)) {
    return;
  }

  event.preventDefault();
  gameState.queuedDirection = DIRECTIONS[event.key];
}

function isSmartphoneTouchDevice() {
  return window.matchMedia(SMARTPHONE_MEDIA_QUERY).matches;
}

function updateJoystickVisibility() {
  updateMobileControlsVisibility();
}

function updateMobileControlsVisibility() {
  if (!touchJoystick) {
    return;
  }

  const isMobile = isSmartphoneTouchDevice();
  const showJoystick = isMobile && gameState.started && !gameState.finished;
  const showMobileStart = isMobile && (!gameState.started || gameState.finished);

  startButton.classList.toggle("mobile-hidden", isMobile);

  if (mobileStartSlot) {
    mobileStartSlot.classList.toggle("active", showMobileStart);
    mobileStartSlot.setAttribute("aria-hidden", String(!showMobileStart));
  }

  if (startButtonMobile) {
    startButtonMobile.disabled = !showMobileStart;
  }

  touchJoystick.classList.toggle("active", showJoystick);
  touchJoystick.setAttribute("aria-hidden", String(!showJoystick));

  if (!showJoystick) {
    resetThumb();
  }
}

function updateJoystickGeometry() {
  if (!joystickBase) {
    return;
  }

  const bounds = joystickBase.getBoundingClientRect();
  joystickState.centerX = bounds.left + bounds.width / 2;
  joystickState.centerY = bounds.top + bounds.height / 2;
  joystickState.maxDistance = bounds.width * 0.28;
  joystickState.deadZone = bounds.width * 0.12;
}

function clampThumb(offsetX, offsetY) {
  const distance = Math.hypot(offsetX, offsetY);

  if (distance <= joystickState.maxDistance || distance === 0) {
    return { x: offsetX, y: offsetY, distance };
  }

  const ratio = joystickState.maxDistance / distance;
  return {
    x: offsetX * ratio,
    y: offsetY * ratio,
    distance: joystickState.maxDistance
  };
}

function updateQueuedDirection(offsetX, offsetY) {
  if (Math.hypot(offsetX, offsetY) < joystickState.deadZone) {
    return;
  }

  if (Math.abs(offsetX) > Math.abs(offsetY)) {
    gameState.queuedDirection = offsetX > 0 ? DIRECTIONS.ArrowRight : DIRECTIONS.ArrowLeft;
    return;
  }

  gameState.queuedDirection = offsetY > 0 ? DIRECTIONS.ArrowDown : DIRECTIONS.ArrowUp;
}

function placeThumb(offsetX, offsetY) {
  if (!joystickThumb) {
    return;
  }

  joystickThumb.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;
}

function resetThumb() {
  placeThumb(0, 0);
}

function handleJoystickPointerDown(event) {
  if (!isSmartphoneTouchDevice()) {
    return;
  }

  joystickState.activePointerId = event.pointerId;
  updateJoystickGeometry();
  joystickBase.setPointerCapture(event.pointerId);
  handleJoystickPointerMove(event);
}

function handleJoystickPointerMove(event) {
  if (event.pointerId !== joystickState.activePointerId) {
    return;
  }

  const rawOffsetX = event.clientX - joystickState.centerX;
  const rawOffsetY = event.clientY - joystickState.centerY;
  const clamped = clampThumb(rawOffsetX, rawOffsetY);

  placeThumb(clamped.x, clamped.y);
  updateQueuedDirection(clamped.x, clamped.y);
}

function releaseJoystickPointer(event) {
  if (event.pointerId !== joystickState.activePointerId) {
    return;
  }

  joystickState.activePointerId = null;
  resetThumb();
}

function setupTouchJoystick() {
  if (!joystickBase || !touchJoystick) {
    return;
  }

  joystickBase.addEventListener("pointerdown", handleJoystickPointerDown);
  joystickBase.addEventListener("pointermove", handleJoystickPointerMove);
  joystickBase.addEventListener("pointerup", releaseJoystickPointer);
  joystickBase.addEventListener("pointercancel", releaseJoystickPointer);
  window.addEventListener("resize", updateJoystickGeometry);
  updateMobileControlsVisibility();
}

startButton.addEventListener("click", startGame);
startButtonMobile.addEventListener("click", startGame);
restartButton.addEventListener("click", restartGame);
soundButton.addEventListener("click", toggleSound);
window.addEventListener("keydown", handleKeydown);
window.addEventListener("resize", renderGame);
window.addEventListener("resize", updateMobileControlsVisibility);

setupGame();
setupTouchJoystick();