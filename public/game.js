const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const hud = document.getElementById("hud");

const name = (localStorage.getItem("playerName") || "").trim();
if (!name) location.href = "/";

// Check: schon gespielt? -> direkt leaderboard
const hasPlayed = localStorage.getItem("hasPlayed") === "1";
if (hasPlayed) {
  location.href = "/leaderboard?msg=played";
}

const size = 20;
const cols = canvas.width / size;
const rows = canvas.height / size;

let dir = "R";
let nextDir = "R";
let snake = [{x:5,y:10},{x:4,y:10},{x:3,y:10}];
let food = {x:12,y:10};
let score = 0;
let alive = true;

function placeFood() {
  while (true) {
    const f = { x: Math.floor(Math.random()*cols), y: Math.floor(Math.random()*rows) };
    if (!snake.some(s => s.x === f.x && s.y === f.y)) { food = f; return; }
  }
}

function render() {
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // food
  ctx.fillRect(food.x*size, food.y*size, size, size);

  // snake
  for (const s of snake) ctx.strokeRect(s.x*size, s.y*size, size, size);

  hud.textContent = `Name: ${name} | Score: ${score}`;
}

function end() {
  alive = false;

  // Flag setzen: dieses Gerät/Browser hat gespielt
  localStorage.setItem("hasPlayed", "1");

  hud.textContent = `Game Over | Score: ${score} (wird gespeichert...)`;

  fetch("/api/submit-score", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ name, score })
  }).finally(() => {
    hud.textContent = `Game Over | Score: ${score} (gespeichert)`;
    // optional: direkt leaderboard öffnen
    // location.href = "/leaderboard";
  });
}

function step() {
  if (!alive) return;

  // reverse verhindern
  const rev =
    (dir==="U"&&nextDir==="D")||(dir==="D"&&nextDir==="U")||
    (dir==="L"&&nextDir==="R")||(dir==="R"&&nextDir==="L");
  if (!rev) dir = nextDir;

  const head = snake[0];
  const nh = { x: head.x, y: head.y };
  if (dir==="U") nh.y--;
  if (dir==="D") nh.y++;
  if (dir==="L") nh.x--;
  if (dir==="R") nh.x++;

  // collision: wall
  if (nh.x<0 || nh.x>=cols || nh.y<0 || nh.y>=rows) return end();
  // collision: self
  if (snake.some(s => s.x===nh.x && s.y===nh.y)) return end();

  snake.unshift(nh);

  if (nh.x===food.x && nh.y===food.y) {
    score += 10;
    placeFood();
  } else {
    snake.pop();
  }

  render();
}

window.addEventListener("keydown", (e) => {
  if (e.key==="ArrowUp") nextDir="U";
  if (e.key==="ArrowDown") nextDir="D";
  if (e.key==="ArrowLeft") nextDir="L";
  if (e.key==="ArrowRight") nextDir="R";
});

// swipe fürs handy
let sx=0, sy=0;
window.addEventListener("touchstart", (e)=>{ sx=e.touches[0].clientX; sy=e.touches[0].clientY; }, {passive:true});
window.addEventListener("touchend", (e)=>{
  const ex=e.changedTouches[0].clientX, ey=e.changedTouches[0].clientY;
  const dx=ex-sx, dy=ey-sy;
  if (Math.abs(dx)>Math.abs(dy)) nextDir = dx>0 ? "R":"L";
  else nextDir = dy>0 ? "D":"U";
}, {passive:true});

placeFood();
render();
setInterval(step, 120);
