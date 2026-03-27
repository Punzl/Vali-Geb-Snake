const express = require("express");
const path = require("path");

const app = express();
app.use(express.json({ limit: "16kb" }));
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));

/**
 * Leaderboard Reveal:
 * - FIX/robust (empfohlen auf Vercel): setze PARTY_START_ISO in Vercel Env Vars
 *   Beispiel Wien: 2026-03-22T22:30:00+01:00 (oder +02:00 im Sommer)
 *
 * - Fallback (wenn ENV fehlt): heute 22:30 SERVER-LOKALZEIT.
 *   Danach bleibt es "sticky" (verschwindet nicht um Mitternacht), ABER nur solange
 *   diese Server-Instanz lebt (bei Vercel Serverless kann es Cold Starts geben).
 */
function getPartyStart() {
  const iso = process.env.PARTY_START_ISO;
  if (iso) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const d = new Date();
  d.setHours(22, 30, 0, 0); // <-- Default: 22:30
  return d;
}

let PARTY_START = getPartyStart();
let REVEALED_STICKY = false;

let scores = []; // { name, score, ts }
const bestByName = new Map(); // name -> bestScore

function leaderboardEnabledNow() {
  if (REVEALED_STICKY) return true;
  if (Date.now() >= PARTY_START.getTime()) {
    REVEALED_STICKY = true; // <-- bleibt TRUE (verschwindet nicht um 0:00)
    return true;
  }
  return false;
}

app.get("/api/status", (req, res) => {
  const enabled = leaderboardEnabledNow();
  res.json({
    leaderboardEnabled: enabled,
    partyStart: PARTY_START.toISOString(),
    serverNow: new Date().toISOString(),
    sticky: REVEALED_STICKY,
  });
});

app.post("/api/submit-score", (req, res) => {
  const name = String(req.body?.name ?? "").trim().slice(0, 32);
  const scoreRaw = Number(req.body?.score);

  if (!name) return res.status(400).json({ error: "Invalid name" });
  if (!Number.isFinite(scoreRaw)) return res.status(400).json({ error: "Invalid score" });

  const score = Math.max(0, Math.min(999999, Math.floor(scoreRaw)));

  const prev = bestByName.get(name);
  if (prev === undefined || score > prev) {
    bestByName.set(name, score);
    scores.push({ name, score, ts: Date.now() });
  }

  scores.sort((a, b) => b.score - a.score || a.ts - b.ts);
  scores = scores.slice(0, 500);

  res.json({ ok: true, best: bestByName.get(name) });
});

app.get("/api/leaderboard", (req, res) => {
  if (!leaderboardEnabledNow()) {
    return res.status(403).json({ error: "Not available yet", partyStart: PARTY_START.toISOString() });
  }
  res.json({ rows: scores.slice(0, 50), partyStart: PARTY_START.toISOString() });
});

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public/index.html")));
app.get("/play", (req, res) => res.sendFile(path.join(__dirname, "public/play.html")));
app.get("/leaderboard", (req, res) => res.sendFile(path.join(__dirname, "public/leaderboard.html")));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`listening on http://localhost:${port}`);
  console.log(`party start: ${PARTY_START.toString()} (ISO: ${PARTY_START.toISOString()})`);
});
