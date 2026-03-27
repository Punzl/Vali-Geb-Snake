// ====== Guards ======
const name = (localStorage.getItem("playerName") || "").trim();
if (!name) location.href = "/";

const hasPlayed = localStorage.getItem("hasPlayed") === "1";
if (hasPlayed) location.href = "/leaderboard?msg=played";

const overlay = document.getElementById("overlay");
const readyBtn = document.getElementById("ready");
const hint = document.getElementById("hint");

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

// ====== iOS: Double-tap zoom guard ======
let lastTouchEnd = 0;
document.addEventListener("touchend", (e) => {
  const now = Date.now();
  if (now - lastTouchEnd <= 300) e.preventDefault();
  lastTouchEnd = now;
}, { passive: false });

// ====== Responsive Canvas ======
function setupCanvas(){
  const max = 520;
  const w = Math.min(max, Math.max(300, Math.floor(window.innerWidth - 28)));
  canvas.width = w;
  canvas.height = w;
}
setupCanvas();
window.addEventListener("resize", () => {
  setupCanvas();
  render();
});

// ====== Game State ======
let running = false;
let alive = true;
let score = 0;

function getCellSize(){
  const w = canvas.width;
  if (w <= 340) return 16;
  if (w <= 420) return 18;
  return 20;
}
function cols(){ return Math.floor(canvas.width / getCellSize()); }
function rows(){ return Math.floor(canvas.height / getCellSize()); }

function isOpposite(a, b){
  return (a === "U" && b === "D") || (a === "D" && b === "U") ||
         (a === "L" && b === "R") || (a === "R" && b === "L");
}

let dir = "R";
let nextDir = "R";

let snake = [{x:5,y:10},{x:4,y:10},{x:3,y:10}];
let food = {x:12,y:10};

function resetGame(){
  alive = true;
  score = 0;
  dir = "R";
  nextDir = "R";
  snake = [{x:5,y:10},{x:4,y:10},{x:3,y:10}];
  placeFood();
  render();
}

function placeFood(){
  const C = cols(), R = rows();
  while(true){
    const f = { x: Math.floor(Math.random()*C), y: Math.floor(Math.random()*R) };
    if (!snake.some(s => s.x === f.x && s.y === f.y)) { food = f; return; }
  }
}

function setDir(d){
  if (!running || !alive) return;
  if (isOpposite(dir, d)) return; // prevent instant reverse
  nextDir = d;
}

// Keyboard fallback (optional)
window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowUp") setDir("U");
  if (e.key === "ArrowDown") setDir("D");
  if (e.key === "ArrowLeft") setDir("L");
  if (e.key === "ArrowRight") setDir("R");
});

// ====== Swipe 4-direction (canvas) ======
let sx=0, sy=0;
let swiping = false;

canvas.addEventListener("touchstart", (e)=> {
  if (!e.touches || !e.touches[0]) return;
  e.preventDefault();
  swiping = true;
  sx = e.touches[0].clientX;
  sy = e.touches[0].clientY;
}, { passive:false });

canvas.addEventListener("touchmove", (e)=> {
  if (swiping) e.preventDefault();
}, { passive:false });

canvas.addEventListener("touchend", (e)=> {
  if (!swiping) return;
  e.preventDefault();
  swiping = false;

  if (!e.changedTouches || !e.changedTouches[0]) return;
  const ex = e.changedTouches[0].clientX;
  const ey = e.changedTouches[0].clientY;
  const dx = ex - sx;
  const dy = ey - sy;

  const th = 18;
  if (Math.abs(dx) < th && Math.abs(dy) < th) return;

  // choose dominant axis
  if (Math.abs(dx) > Math.abs(dy)) {
    setDir(dx > 0 ? "R" : "L");
  } else {
    setDir(dy > 0 ? "D" : "U");
  }
}, { passive:false });

// ====== Rendering (thick map border + thicker tail outlines) ======
function render(){
  const cell = getCellSize();
  const C = cols(), R = rows();
  const mapW = C * cell;
  const mapH = R * cell;

  ctx.clearRect(0,0,canvas.width,canvas.height);

  const gridStroke = "rgba(255,255,255,0.22)";
  const mapBorderStroke = "rgba(255,255,255,0.70)";
  const snakeStroke = "rgba(255,255,255,0.80)";
  const fillWhite = "rgba(255,255,255,0.92)";

  // grid
  ctx.lineWidth = 1;
  ctx.strokeStyle = gridStroke;
  for(let x=0;x<=C;x++){
    ctx.beginPath();
    ctx.moveTo(x*cell+0.5, 0);
    ctx.lineTo(x*cell+0.5, mapH);
    ctx.stroke();
  }
  for(let y=0;y<=R;y++){
    ctx.beginPath();
    ctx.moveTo(0, y*cell+0.5);
    ctx.lineTo(mapW, y*cell+0.5);
    ctx.stroke();
  }

  // map border (thick)
  ctx.lineWidth = 4;
  ctx.strokeStyle = mapBorderStroke;
  ctx.strokeRect(2, 2, mapW - 4, mapH - 4);

  // food
  ctx.fillStyle = fillWhite;
  ctx.fillRect(food.x*cell, food.y*cell, cell, cell);

  // snake
  snake.forEach((s, i) => {
    const x = s.x*cell;
    const y = s.y*cell;
    if (i === 0) {
      ctx.fillStyle = fillWhite;
      ctx.fillRect(x, y, cell, cell);
      ctx.lineWidth = 3;
      ctx.strokeStyle = snakeStroke;
      ctx.strokeRect(x+1.5, y+1.5, cell-3, cell-3);
    } else {
      ctx.lineWidth = 2;
      ctx.strokeStyle = snakeStroke;
      ctx.strokeRect(x+1, y+1, cell-2, cell-2);
    }
  });

  hint.textContent = running ? `Score: ${score}` : "";
}

// ====== Game Loop ======
async function gameOver(){
  alive = false;
  running = false;

  localStorage.setItem("hasPlayed", "1");
  hint.textContent = `Game Over — Score: ${score} (speichere…)`;

  await fetch("/api/submit-score", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ name, score })
  }).catch(()=>{});

  hint.textContent = `Game Over — Score: ${score} (gespeichert)`;
  setTimeout(() => location.href = "/leaderboard?msg=played", 700);
}

function step(){
  if (!running || !alive) return;

  dir = nextDir;

  const head = snake[0];
  const nh = { x: head.x, y: head.y };

  if (dir === "U") nh.y--;
  if (dir === "R") nh.x++;
  if (dir === "D") nh.y++;
  if (dir === "L") nh.x--;

  const C = cols(), R = rows();

  if (nh.x < 0 || nh.x >= C || nh.y < 0 || nh.y >= R) return gameOver();
  if (snake.some(s => s.x===nh.x && s.y===nh.y)) return gameOver();

  snake.unshift(nh);

  if (nh.x === food.x && nh.y === food.y) {
    score += 10;
    placeFood();
  } else {
    snake.pop();
  }

  render();
}

// ====== READY ======
function startGame(){
  if (running) return;
  overlay.style.display = "none";
  resetGame();
  running = true;
}
readyBtn.addEventListener("pointerup", (e) => { e.preventDefault(); startGame(); });
readyBtn.addEventListener("click", (e) => { e.preventDefault(); startGame(); });

resetGame();
setInterval(step, 115);
