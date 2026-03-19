const express = require("express");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Leaderboard erst ab 20:00 (lokale Serverzeit)
const PARTY_START = new Date();
PARTY_START.setHours(20, 0, 0, 0);

// Für Test: sofort aktivieren (auskommentieren, wenn du echt 20:00 willst)
// PARTY_START.setTime(Date.now() - 60_000);

// In-memory Speicher (für Start ok; später DB)
let scores = []; // { name, score, ts }

app.get("/api/status", (req, res) => {
  res.json({
    leaderboardEnabled: Date.now() >= PARTY_START.getTime(),
    partyStart: PARTY_START.toISOString(),
  });
});

app.post("/api/submit-score", (req, res) => {
  const name = String(req.body?.name ?? "").trim().slice(0, 32);
  const score = Number(req.body?.score);

  if (!name) return res.status(400).json({ error: "Invalid name" });
  if (!Number.isFinite(score)) return res.status(400).json({ error: "Invalid score" });

  scores.push({ name, score: Math.floor(score), ts: Date.now() });

  // sort: score desc, dann ts asc
  scores.sort((a, b) => b.score - a.score || a.ts - b.ts);
  scores = scores.slice(0, 200);

  res.json({ ok: true });
});

app.get("/api/leaderboard", (req, res) => {
  if (Date.now() < PARTY_START.getTime()) {
    return res.status(403).json({ error: "Not available yet" });
  }
  res.json({ rows: scores.slice(0, 50) });
});

// explizite routes
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public/index.html")));
app.get("/play", (req, res) => res.sendFile(path.join(__dirname, "public/play.html")));
app.get("/leaderboard", (req, res) => res.sendFile(path.join(__dirname, "public/leaderboard.html")));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`listening on http://localhost:${port}`));
