const boardSize = 4;
const targetValue = 2048;

const boardElement = document.getElementById("board");
const scoreElement = document.getElementById("score");
const bestElement = document.getElementById("best");
const newGameButton = document.getElementById("new-game");
const undoButton = document.getElementById("undo-move");
const gameOverOverlay = document.getElementById("game-over");
const gameWinOverlay = document.getElementById("game-win");
const gameWin4096Overlay = document.getElementById("game-win-4096");


const keyMap = {
  ArrowUp: "up",
  w: "up",
  ArrowDown: "down",
  s: "down",
  ArrowLeft: "left",
  a: "left",
  ArrowRight: "right",
  d: "right",
};

let tiles = [];
let score = 0;
let best = Number(localStorage.getItem("주은2048-best")) || 0;
let historyStack = [];
const animationState = { newTiles: [], mergedTiles: [] };
let hasWon = false;
let hasWon4096 = false;

bestElement.textContent = best;

function createEmptyBoard() {
  tiles = Array.from({ length: boardSize }, () => Array(boardSize).fill(null));
}

function getEmptySpaces() {
  const empty = [];
  tiles.forEach((row, y) => row.forEach((value, x) => value === null && empty.push({ x, y })));
  return empty;
}

function addRandomTile(trackAnimation = true) {
  const emptySpaces = getEmptySpaces();
  if (!emptySpaces.length) return;
  const { x, y } = emptySpaces[Math.floor(Math.random() * emptySpaces.length)];
  tiles[y][x] = Math.random() < 0.8 ? 2 : 4;
  if (trackAnimation) {
    animationState.newTiles.push({ x, y });
  }
}

function cloneTiles() {
  return tiles.map((row) => [...row]);
}

function saveHistory() {
  historyStack = [
    {
      tiles: cloneTiles(),
      score,
    },
  ];
  undoButton.disabled = false;
}

function undoMove() {
  if (!historyStack.length) return;
  const snapshot = historyStack.pop();
  tiles = snapshot.tiles.map((row) => [...row]);
  score = snapshot.score;
  updateScoreDisplay();
  renderTiles();
  if (gameOverOverlay) {
    gameOverOverlay.classList.remove("is-visible");
  }
  undoButton.disabled = true;
}

function compressLine(line) {
  const filtered = line.filter((value) => value !== null);
  const merged = [];
  const mergedIndices = [];
  let skip = false;

  for (let i = 0; i < filtered.length; i++) {
    if (skip) {
      skip = false;
      continue;
    }
    const current = filtered[i];
    const next = filtered[i + 1];
    if (current === next) {
      const mergedValue = current * 2;
      merged.push(mergedValue);
      mergedIndices.push(merged.length - 1);
      score += mergedValue;
      skip = true;
    } else {
      merged.push(current);
    }
  }

  while (merged.length < boardSize) {
    merged.push(null);
  }

  return { line: merged, mergedIndices };
}

function transpose(matrix) {
  return matrix[0].map((_, colIndex) => matrix.map((row) => row[colIndex]));
}

function setColumnFromArray(column, x) {
  column.forEach((value, y) => {
    tiles[y][x] = value;
  });
}

function arraysEqual(a, b) {
  return a.every((value, index) => value === b[index]);
}

function move(direction) {
  if (!direction) return;
  animationState.mergedTiles = [];
  animationState.newTiles = [];
  const prev = cloneTiles();
  let moved = false;

  switch (direction) {
    case "left":
      tiles = tiles.map((row, rowIndex) => {
        const { line, mergedIndices } = compressLine(row);
        if (!moved && !arraysEqual(row, line)) moved = true;
        mergedIndices.forEach((index) => animationState.mergedTiles.push({ x: index, y: rowIndex }));
        return line;
      });
      break;
    case "right":
      tiles = tiles.map((row, rowIndex) => {
        const reversed = [...row].reverse();
        const { line, mergedIndices } = compressLine(reversed);
        const restored = [...line].reverse();
        if (!moved && !arraysEqual(row, restored)) moved = true;
        mergedIndices.forEach((index) =>
          animationState.mergedTiles.push({ x: boardSize - 1 - index, y: rowIndex })
        );
        return restored;
      });
      break;
    case "up":
      for (let x = 0; x < boardSize; x++) {
        const column = tiles.map((row) => row[x]);
        const { line, mergedIndices } = compressLine(column);
        if (!moved && !arraysEqual(column, line)) moved = true;
        mergedIndices.forEach((index) => animationState.mergedTiles.push({ x, y: index }));
        setColumnFromArray(line, x);
      }
      break;
    case "down":
      for (let x = 0; x < boardSize; x++) {
        const column = tiles.map((row) => row[x]).reverse();
        const { line, mergedIndices } = compressLine(column);
        const restored = [...line].reverse();
        const original = tiles.map((row) => row[x]);
        if (!moved && !arraysEqual(original, restored)) moved = true;
        mergedIndices.forEach((index) => animationState.mergedTiles.push({ x, y: boardSize - 1 - index }));
        setColumnFromArray(restored, x);
      }
      break;
  }

  if (!moved) return;

  saveHistory();
  addRandomTile();
  updateScoreDisplay();
  renderTiles();
  checkGameState();
}

function renderTiles() {
  boardElement.innerHTML = "";
  tiles.forEach((row, y) =>
    row.forEach((value, x) => {
      const tile = document.createElement("div");
      tile.classList.add("tile");
      tile.dataset.x = x;
      tile.dataset.y = y;

      if (!value) {
        tile.classList.add("tile--empty");
      } else {
        tile.dataset.value = value;
        const image = new Image();
        image.alt = `${value}`;
        image.src = `./images/${value}.png`;
        image.onerror = () => {
          tile.textContent = value;
          tile.style.fontSize = "1.4rem";
        };
        image.onload = () => tile.appendChild(image);
      }

      if (animationState.newTiles.some((pos) => pos.x === x && pos.y === y)) tile.classList.add("tile--new");
      if (animationState.mergedTiles.some((pos) => pos.x === x && pos.y === y)) tile.classList.add("tile--merge");

      boardElement.appendChild(tile);
    })
  );

  undoButton.disabled = historyStack.length === 0;
}

function updateScoreDisplay() {
  scoreElement.textContent = score;
  if (score > best) {
    best = score;
    bestElement.textContent = best;
    localStorage.setItem("주은2048-best", best);
  }
}

function isGameOver() {
  if (getEmptySpaces().length) return false;
  for (let y = 0; y < boardSize; y++) {
    for (let x = 0; x < boardSize; x++) {
      const current = tiles[y][x];
      if ((x < boardSize - 1 && tiles[y][x + 1] === current) || (y < boardSize - 1 && tiles[y + 1][x] === current)) {
        return false;
      }
    }
  }
  return true;
}

function checkGameState() {
  const flattened = tiles.flat();
  if (!hasWon4096 && flattened.includes(4096)) {
    hasWon4096 = true;
    setTimeout(() => {
      if (gameWin4096Overlay) {
        gameWin4096Overlay.classList.add("is-visible");
      }
    }, 50);
  }
  if (!hasWon && flattened.includes(targetValue)) {
    hasWon = true;
    setTimeout(() => {
      if (gameWinOverlay) {
        gameWinOverlay.classList.add("is-visible");
      }
    }, 50);
  } else if (isGameOver()) {
    setTimeout(() => {
      if (gameOverOverlay) {
        gameOverOverlay.classList.add("is-visible");
      }
    }, 50);
  }
}

// function setupSwipeControls() {
//   let startX = null;
//   let startY = null;

//   boardElement.addEventListener("touchstart", (event) => {
//     const touch = event.touches[0];
//     startX = touch.clientX;
//     startY = touch.clientY;
//   });

//   boardElement.addEventListener(
//   "touchmove",
//   (event) => {
//     event.preventDefault();
//   },
//   { passive: false }
//    );


//   boardElement.addEventListener("touchend", (event) => {
//     const touch = event.changedTouches[0];
//     if (startX === null || startY === null) return;
//     const diffX = touch.clientX - startX;
//     const diffY = touch.clientY - startY;
//     if (Math.abs(diffX) > Math.abs(diffY)) {
//       move(diffX > 30 ? "right" : diffX < -30 ? "left" : null);
//     } else {
//       move(diffY > 30 ? "down" : diffY < -30 ? "up" : null);
//     }
//     startX = null;
//     startY = null;
//   });
// }

function setupSwipeControls() {
  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let currentY = 0;
  let isTouching = false;
  const SWIPE_THRESHOLD = 30;

  boardElement.style.touchAction = "none";

  boardElement.addEventListener(
    "touchstart",
    (event) => {
      if (event.touches.length !== 1) return;
      event.preventDefault();
      const touch = event.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      currentX = startX;
      currentY = startY;
      isTouching = true;
    },
    { passive: false }
  );

  boardElement.addEventListener(
    "touchmove",
    (event) => {
      if (!isTouching) return;
      event.preventDefault();
      const touch = event.touches[0];
      currentX = touch.clientX;
      currentY = touch.clientY;
    },
    { passive: false }
  );

  boardElement.addEventListener(
    "touchend",
    (event) => {
      if (!isTouching) return;
      event.preventDefault();

      const diffX = currentX - startX;
      const diffY = currentY - startY;

      if (Math.abs(diffX) > Math.abs(diffY)) {
        if (Math.abs(diffX) > SWIPE_THRESHOLD) {
          move(diffX > 0 ? "right" : "left");
        }
      } else {
        if (Math.abs(diffY) > SWIPE_THRESHOLD) {
          move(diffY > 0 ? "down" : "up");
        }
      }

      isTouching = false;
    },
    { passive: false }
  );

  boardElement.addEventListener(
    "touchcancel",
    () => {
      isTouching = false;
    },
    { passive: true }
  );
}

function closeWinOverlay() {
  if (gameWinOverlay) {
    gameWinOverlay.classList.remove("is-visible");
  }
}

function closeWin4096Overlay() {
  if (gameWin4096Overlay) {
    gameWin4096Overlay.classList.remove("is-visible");
  }
}

function closeGameOverOverlay() {
  if (gameOverOverlay) {
    gameOverOverlay.classList.remove("is-visible");
  }
}


function startGame() {
  score = 0;
  historyStack = [];
  animationState.newTiles = [];
  animationState.mergedTiles = [];
  hasWon = false;
  hasWon4096 = false;
  if (gameOverOverlay) {
    gameOverOverlay.classList.remove("is-visible");
  }
  if (gameWinOverlay) {
    gameWinOverlay.classList.remove("is-visible");
  }
  if (gameWin4096Overlay) {
    gameWin4096Overlay.classList.remove("is-visible");
  }
  createEmptyBoard();
  addRandomTile();
  addRandomTile();
  updateScoreDisplay();
  renderTiles();
  undoButton.disabled = true;
}

function init() {
  if (!boardElement) return;
  updateScoreDisplay();
  setupSwipeControls();

  if (gameWinOverlay) {
    gameWinOverlay.addEventListener("click", closeWinOverlay);
    gameWinOverlay.addEventListener("touchstart", closeWinOverlay, { passive: true });
  }
  if (gameWin4096Overlay) {
    gameWin4096Overlay.addEventListener("click", closeWin4096Overlay);
    gameWin4096Overlay.addEventListener("touchstart", closeWin4096Overlay, { passive: true });
  }
  if (gameOverOverlay) {
    gameOverOverlay.addEventListener("click", closeGameOverOverlay);
    gameOverOverlay.addEventListener("touchstart", closeGameOverOverlay, { passive: true });
  }

  newGameButton.addEventListener("click", startGame);
  undoButton.addEventListener("click", undoMove);

  window.addEventListener("keydown", (event) => {
    if (keyMap[event.key]) {
      event.preventDefault();
      move(keyMap[event.key]);
    }
  });

  startGame();
}

document.addEventListener("deviceready", () => {
  if (window.StatusBar) {
    StatusBar.hide();
  }
});


init();