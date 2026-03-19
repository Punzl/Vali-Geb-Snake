const msg = document.getElementById("msg");
const list = document.getElementById("list");

const params = new URLSearchParams(location.search);
const playedMsg = params.get("msg") === "played";

if (playedMsg) {
  msg.textContent = "Du hast bereits gespielt.";
}

async function load() {
  list.innerHTML = "";
  if (!playedMsg) msg.textContent = "";

  const st = await fetch("/api/status").then(r=>r.json()).catch(()=>null);
  if (!st) { msg.textContent = "Status error"; return; }

  if (!st.leaderboardEnabled) {
    msg.textContent = playedMsg
      ? "Du hast bereits gespielt. Leaderboard ist noch gesperrt (erst ab 20:00)."
      : "Noch gesperrt (erst ab 20:00).";
    return;
  }

  const lb = await fetch("/api/leaderboard")
    .then(async r => ({ ok:r.ok, body: await r.json() }))
    .catch(()=>null);

  if (!lb || !lb.ok) {
    msg.textContent = lb?.body?.error ?? "Leaderboard error";
    return;
  }

  for (const r of lb.body.rows) {
    const li = document.createElement("li");
    li.textContent = `${r.name} — ${r.score}`;
    list.appendChild(li);
  }
}

load();
setInterval(load, 5000);
