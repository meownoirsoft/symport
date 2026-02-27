#!/usr/bin/env node
/**
 * Verify OpenRouter model IDs against a local list.
 * Usage:
 *   OPENROUTER_API_KEY=... node verify-openrouter-models.mjs
 */
import 'dotenv/config';
const OPENROUTER_URL = "https://openrouter.ai/api/v1/models";
const key = process.env.OPENROUTER_API_KEY;

if (!key) {
  console.error("Missing OPENROUTER_API_KEY env var.");
  process.exit(1);
}

const rawWanted = [
  "qwen-2.5-72b-instruct",
  "llama-3.1-70b-instruct",
  "gemini-flash-1.5",
  "gpt-4o-mini-2024-07-18 OSS Free",
  "deepseek-v3",
  "llama-3.1-405b-instruct",
  "claude-3-haiku",
  "gemini-pro-1.5",
  "mistral-large",
  "claude-3-5-sonnet<br>",
  "gpt-4o",
  "gpt-5",
  "gpt-4-turbo",
  "claude-3-opus",
];

function normalize(s) {
  return s
    .toLowerCase()
    .replace(/<br\s*\/?>/g, "")
    .replace(/\boss\b/g, "")
    .replace(/\bfree\b/g, "")
    .replace(/[^a-z0-9.\-_/:\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function baseTokens(s) {
  // useful for matching "claude-3-5-sonnet" vs "claude-3.5-sonnet"
  return normalize(s).replace(/-/g, " ").replace(/\./g, " ").split(" ").filter(Boolean);
}

const res = await fetch(OPENROUTER_URL, {
  headers: {
    Authorization: `Bearer ${key}`,
    // Optional but recommended by OpenRouter:
    "HTTP-Referer": "http://localhost",
    "X-Title": "model-verifier",
  },
});

if (!res.ok) {
  console.error("OpenRouter API error:", res.status, await res.text());
  process.exit(1);
}

const data = await res.json();
const models = (data?.data ?? data?.models ?? []);
const ids = models.map((m) => m.id).filter(Boolean);

const normIdToReal = new Map(ids.map((id) => [normalize(id), id]));
const normIds = Array.from(normIdToReal.keys());

function findExact(wanted) {
  const n = normalize(wanted);
  return normIdToReal.get(n) ?? null;
}

function findContains(wanted) {
  const n = normalize(wanted);
  // direct substring contains
  const hits = normIds
    .filter((id) => id.includes(n) || n.includes(id))
    .slice(0, 5)
    .map((nid) => normIdToReal.get(nid));
  return hits;
}

function findTokenScore(wanted) {
  const tokens = new Set(baseTokens(wanted));
  const scored = normIds
    .map((nid) => {
      const t2 = baseTokens(nid);
      let hit = 0;
      for (const t of t2) if (tokens.has(t)) hit++;
      return { nid, hit, len: t2.length };
    })
    .filter((x) => x.hit > 0)
    .sort((a, b) => b.hit - a.hit || a.len - b.len)
    .slice(0, 5)
    .map((x) => normIdToReal.get(x.nid));
  return scored;
}

console.log(`Fetched ${ids.length} models from OpenRouter.\n`);

for (const w of rawWanted) {
  const exact = findExact(w);
  if (exact) {
    console.log(`✅ ${w}  ->  ${exact}`);
    continue;
  }

  const contains = findContains(w);
  const tokens = findTokenScore(w);
  const suggestions = Array.from(new Set([...(contains ?? []), ...(tokens ?? [])])).slice(0, 5);

  if (suggestions.length) {
    console.log(`🟡 ${w}  ->  close matches:`);
    for (const s of suggestions) console.log(`   - ${s}`);
  } else {
    console.log(`❌ ${w}  ->  no match found`);
  }
  console.log("");
}