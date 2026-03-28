const express = require("express");
const path = require("path");
const { Redis } = require("@upstash/redis");

const app = express();
app.use(express.json({ limit: "16kb" }));
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));

// ---------- Reveal Time (22:30 Wien via ENV recommended) ----------
function getPartyStart() {
  const iso = process.env.PARTY_START_ISO;
  if (iso) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const d = new Date();
  d.setHours(22, 30, 0, 0); // fallback (server local time)
  return d;
}
const PARTY_START = getPartyStart();
const PREFIX = process.env.KV_PREFIX || "valigebsnake";

function leaderboardEnabledNow() {
  return Date.now() >= PARTY_START.getTime();
}

// ---------- Upstash Redis ----------
const hasRedisEnv =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = hasRedisEnv
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

const KEY_BEST = `${PREFIX}:bestByName`;    // hash: name -> bestScore
const KEY_ZSET = `${PREFIX}:leaderboard`;   // zset: member=name score=bestScore

// Local fallback (nur falls Redis env fehlt)
let memBest = new Map();
let memRows = [];

async function upsertScore(name, score) {
  if (redis) {
    const prev = await redis.hget(KEY_BEST, name);
    const prevNum = prev === null || prev === undefined ? null : Number(prev);

    if (prevNum === null || !Number.isFinite(prevNum) || score > prevNum) {
      await redis.hset(KEY_BEST, { [name]: score });
      // zadd: member=name, score=score
      await redis.zadd(KEY_ZSET, { score, member: name });
      return score;
    }
    return prevNum;
  }

  // memory fallback
  const prev = memBest.get(name);
  if (prev === undefined || score > prev) {
    memBest.set(name, score);
    memRows.push({ name, score, ts: Date.now() });
    memRows.sort((a, b) => b.score - a.score || a.ts - b.ts);
    memRows = memRows.slice(0, 500);
  }
  return memBest.get(name);
}

async function getTop(n) {
  if (redis) {
    // zrange withScores, rev=true for descending
    const entries = await redis.zrange(KEY_ZSET, 0, n - 1, { rev: true, withScores: true });
    // entries: [{ member, score }, ...]
    return (entries || []).map((e) => ({ name: e.member, score: e.score }));
  }
  return memRows.slice(0, n).map((r) => ({ name: r.name, score: r.score }));
}

// ---------- Routes ----------
app.get("/api/status", (req, res) => {
  res.json({
    leaderboardEnabled: leaderboardEnabledNow(),
    partyStart: PARTY_START.toISOString(),
    serverNow: new Date().toISOString(),
    storage: redis ? "upstash-redis" : "memory",
    prefix: PREFIX,
  });
});

app.post("/api/submit-score", async (req, res) => {
  // Nach Reveal keine neuen Scores mehr
  if (leaderboardEnabledNow()) {
    return res.status(403).json({ error: "Game closed (leaderboard revealed)" });
  }

  const name = String(req.body?.name ?? "").trim().slice(0, 32);
  const scoreRaw = Number(req.body?.score);

  if (!name) return res.status(400).json({ error: "Invalid name" });
  if (!Number.isFinite(scoreRaw)) return res.status(400).json({ error: "Invalid score" });

  const score = Math.max(0, Math.min(999999, Math.floor(scoreRaw)));

  try {
    const best = await upsertScore(name, score);
    return res.json({ ok: true, best });
  } catch (e) {
    return res.status(500).json({ error: "Storage error" });
  }
});

app.get("/api/leaderboard", async (req, res) => {
  if (!leaderboardEnabledNow()) {
    return res.status(403).json({ error: "Not available yet", partyStart: PARTY_START.toISOString() });
  }
  try {
    const rows = await getTop(50);
    return res.json({ rows, partyStart: PARTY_START.toISOString() });
  } catch (e) {
    return res.status(500).json({ error: "Storage error" });
  }
});

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public/index.html")));
app.get("/play", (req, res) => res.sendFile(path.join(__dirname, "public/play.html")));
app.get("/leaderboard", (req, res) => res.sendFile(path.join(__dirname, "public/leaderboard.html")));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`listening on http://localhost:${port}`);
  console.log(`party start: ${PARTY_START.toISOString()}`);
  console.log(`storage: ${redis ? "upstash-redis" : "memory"} prefix=${PREFIX}`);
});
