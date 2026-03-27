const badge = document.getElementById("badge");
const subtitle = document.getElementById("subtitle");
const msg = document.getElementById("msg");
const list = document.getElementById("list");

document.getElementById("home").onclick = () => (location.href = "/");
document.getElementById("refresh").onclick = () => load();

const params = new URLSearchParams(location.search);
const playedMsg = params.get("msg") === "played";
const ownName = (localStorage.getItem("playerName") || "").trim();

function showMsg(text){
  msg.style.display = "block";
  msg.textContent = text;
}
function hideMsg(){
  msg.style.display = "none";
  msg.textContent = "";
}

function fmtCountdown(ms){
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2,"0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2,"0");
  const ss = String(s % 60).padStart(2,"0");
  return `${hh}:${mm}:${ss}`;
}

function namesEqual(a, b){
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function applyGold(li, rank){
  // rank = 1..6
  // etwas “gold-ish” ohne CSS-Änderungen
  li.style.borderColor = "rgba(255, 215, 0, 0.40)";
  li.style.background = "linear-gradient(180deg, rgba(255,215,0,0.14), rgba(255,215,0,0.06))";
  li.style.boxShadow = "0 10px 30px rgba(0,0,0,0.25)";

  // stärkere Markierung für #1
  if (rank === 1) {
    li.style.borderColor = "rgba(255, 215, 0, 0.65)";
    li.style.background = "linear-gradient(180deg, rgba(255,215,0,0.20), rgba(255,215,0,0.08))";
  }
}

async function load(){
  list.innerHTML = "";

  const st = await fetch("/api/status").then(r=>r.json()).catch(()=>null);
  if (!st) {
    badge.textContent = "Status: ?";
    showMsg("Server nicht erreichbar.");
    return;
  }

  const now = Date.now();
  const start = new Date(st.partyStart).getTime();
  const enabled = !!st.leaderboardEnabled;

  badge.textContent = enabled ? "ON" : "OFF";

  if (playedMsg) {
    showMsg(enabled
      ? "Du hast bereits gespielt."
      : `Du hast bereits gespielt. Leaderboard öffnet um 22:30. (${fmtCountdown(start - now)})`
    );
  } else {
    hideMsg();
  }

  if (!enabled) {
    subtitle.textContent = `Leaderboard gesperrt — öffnet in ${fmtCountdown(start - now)} (Serverzeit).`;
    return;
  }

  subtitle.textContent = "Top Scores.";

  const lb = await fetch("/api/leaderboard")
    .then(async r => ({ ok:r.ok, body: await r.json() }))
    .catch(()=>null);

  if (!lb || !lb.ok) {
    showMsg(lb?.body?.error ?? "Leaderboard-Request fehlgeschlagen.");
    return;
  }

  const rows = lb.body.rows ?? [];
  if (!rows.length) {
    showMsg("Noch keine Scores vorhanden.");
    return;
  }

  rows.forEach((r, i) => {
    const rankNum = i + 1;

    const li = document.createElement("li");
    li.className = "item";

    const rank = document.createElement("div");
    rank.className = "rank";
    rank.textContent = String(rankNum);

    const name = document.createElement("div");
    name.className = "name";
    name.textContent = r.name;

    const score = document.createElement("div");
    score.className = "score";
    score.textContent = String(r.score);

    // Top 6 gold
    if (rankNum <= 6) applyGold(li, rankNum);

    // Own name green (überstimmt optisch den Gold-Text)
    if (ownName && typeof r.name === "string" && namesEqual(r.name, ownName)) {
      name.style.color = "rgba(124,255,107,0.95)";
      name.style.textShadow = "0 0 14px rgba(124,255,107,0.25)";
    }

    li.appendChild(rank);
    li.appendChild(name);
    li.appendChild(score);
    list.appendChild(li);
  });
}

load();
