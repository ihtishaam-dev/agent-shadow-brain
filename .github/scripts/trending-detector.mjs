#!/usr/bin/env node
// Trending Detector — runs on a schedule, looks at the stats history, detects
// momentum spikes (stars/day acceleration), and opens an issue suggesting
// time-sensitive actions.
//
// Detection logic:
//   - Compare last-24h star delta vs trailing 7-day average
//   - Spike threshold: 5x baseline OR 50+ stars in 24h (whichever lower)
//   - Cooldown: only fires once per 24h to avoid duplicate issues
//
// Spam-safety (root-cause fix):
//   The previous version trusted ONLY a local state file
//   (.github/.trending-state.json) for the 24h cooldown. The workflow never
//   committed that file, so each fresh checkout reset lastFiredAt to 0 and the
//   cooldown never applied — every run could open another spike issue.
//
//   GitHub is now the source of truth: before posting we check for an OPEN spike
//   issue created within the cooldown window. If one exists, we skip.

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REPO = process.env.REPO || 'theihtisham/agent-shadow-brain';
const HISTORY_PATH = 'docs/stats-history.json';
const STATE_PATH = '.github/.trending-state.json';
const SPIKE_MULT = 5;       // 5x trailing-7d average
const SPIKE_FLOOR = 50;     // OR 50+ stars in 24h
const COOLDOWN_MS = 24 * 60 * 60 * 1000;
const TITLE = '🚀 Momentum spike detected — act fast';

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
}

let history = [];
if (existsSync(HISTORY_PATH)) {
  try { history = JSON.parse(readFileSync(HISTORY_PATH, 'utf-8')); } catch {}
}

if (history.length < 2) {
  console.log('Not enough stats history for trend detection. Need at least 2 days of data.');
  process.exit(0);
}

const today = history[history.length - 1];
const yesterday = history[history.length - 2];
const week = history.slice(-8, -1); // up to 7 days before today

const todayStars = today.stars ?? 0;
const yesterdayStars = yesterday.stars ?? 0;
const dayDelta = todayStars - yesterdayStars;

const trailingAvgDelta = week.length > 0
  ? week.reduce((sum, d, i) => sum + (i > 0 ? (d.stars ?? 0) - (week[i - 1].stars ?? 0) : 0), 0) / Math.max(1, week.length - 1)
  : 0;

const downloadsToday = today.npm?.last_week ?? 0;
const downloadsYesterday = yesterday.npm?.last_week ?? 0;

console.log(`Today: ${todayStars} stars (Δ ${dayDelta}), 7d avg Δ ${trailingAvgDelta.toFixed(1)}`);

const isStarsSpike = (trailingAvgDelta > 0 && dayDelta >= trailingAvgDelta * SPIKE_MULT) || dayDelta >= SPIKE_FLOOR;
const isDownloadsSpike = downloadsYesterday > 0 && downloadsToday > downloadsYesterday * 2;

if (!isStarsSpike && !isDownloadsSpike) {
  console.log('No spike detected.');
  process.exit(0);
}

// ── Cooldown via local cache (fast path) ────────────────────────────────────
let state = { lastFiredAt: 0 };
if (existsSync(STATE_PATH)) {
  try { state = JSON.parse(readFileSync(STATE_PATH, 'utf-8')); } catch {}
}
if (Date.now() - state.lastFiredAt < COOLDOWN_MS) {
  console.log(`Cooldown active (local cache). Last fired ${((Date.now() - state.lastFiredAt) / 3600e3).toFixed(1)}h ago.`);
  process.exit(0);
}

// ── Cooldown via GitHub (source of truth) ───────────────────────────────────
// The local cache is unreliable across fresh checkouts, so confirm against the
// repo: is there an OPEN spike issue created within the cooldown window?
function recentSpikeIssueExists() {
  try {
    const raw = sh(
      `gh issue list --repo "${REPO}" --state open --search ${JSON.stringify(`"${TITLE}" in:title`)} --json createdAt --limit 20`,
    );
    const items = JSON.parse(raw);
    return items.some((i) => Date.now() - new Date(i.createdAt).getTime() < COOLDOWN_MS);
  } catch (err) {
    // Lookup failed — stay spam-safe and skip rather than risk a duplicate.
    console.warn(`Could not verify recent spike issues (${err.message?.split('\n')[0]}). Skipping to stay spam-safe.`);
    return true;
  }
}

if (recentSpikeIssueExists()) {
  console.log('A spike issue was already opened within the cooldown window — skipping (idempotent).');
  process.exit(0);
}

// We have a spike. Build the alert.
const reasons = [];
if (isStarsSpike) {
  reasons.push(`⭐ **Stars spike**: ${dayDelta} new stars in 24h (vs 7d avg of ${trailingAvgDelta.toFixed(1)}/day) — ${trailingAvgDelta > 0 ? `${(dayDelta / trailingAvgDelta).toFixed(1)}x baseline` : 'first detected growth'}`);
}
if (isDownloadsSpike) {
  reasons.push(`📦 **Downloads spike**: ${downloadsToday} weekly downloads (vs ${downloadsYesterday} yesterday) — ${(downloadsToday / Math.max(1, downloadsYesterday)).toFixed(1)}x growth`);
}

const body = `# 🚀 Momentum Spike Detected

**Repo:** ${REPO}
**When:** ${new Date().toISOString()}

## What's Happening

${reasons.map((r) => `- ${r}`).join('\n')}

## Time-Sensitive Actions (next 24-48h)

Viral spikes have a short window. Act fast while the iron is hot:

### Within 1 hour
- [ ] Check [GitHub Insights → Traffic](https://github.com/${REPO}/graphs/traffic) — find the referrer source
- [ ] If a specific blog/HN/Reddit thread is driving it → reply/comment there to keep momentum
- [ ] Pin a relevant post if you have one queued

### Within 24 hours
- [ ] Reply to ANY new issue/PR quickly (engagement keeps you on trending lists)
- [ ] Share to relevant communities you're already part of (your call where)
- [ ] If npm package: confirm latest version is solid (no broken builds, no critical bugs)

### Within 48 hours
- [ ] Update README hero with social proof (current star count, recent stargazer logos via [contrib.rocks](https://contrib.rocks))
- [ ] Cross-link from your other repos (audience overlap)
- [ ] Open the [\`awesome-pr-prepare\`](../actions/workflows/viral-amplifier.yml) workflow — viral momentum + 100+ stars = good time to submit to awesome lists

## Don't Do

- ❌ Buy stars (against GitHub ToS — they ban for it)
- ❌ Spam-DM stargazers thanking them (looks weird)
- ❌ Mass-tag people in posts (filters as spam)
- ❌ Resurrect stale issues just to ping for engagement

## Stats Snapshot

| Metric | Today | Yesterday | 7d Avg Δ |
|---|---:|---:|---:|
| ⭐ Stars | ${todayStars} | ${yesterdayStars} | ${trailingAvgDelta.toFixed(1)}/day |
| 📦 Weekly DL | ${downloadsToday.toLocaleString()} | ${downloadsYesterday.toLocaleString()} | — |

---

_Auto-generated by the Trending Detector. 24h cooldown is enforced against GitHub (open spike issues), not just a local cache._
`;

const tmpFile = join(tmpdir(), 'trending-body.md');
writeFileSync(tmpFile, body);

// Defensive: ensure expected labels exist, then create issue.
const WANTED_LABELS = ['viral-amplifier', 'trending'];
const labelDefs = {
  'viral-amplifier': { color: 'FF4081', description: 'Issues raised by the Viral Amplifier Bot' },
  'trending':        { color: 'F59E0B', description: 'Momentum / trending repo activity' },
};

function ensureLabel(name) {
  try {
    sh(`gh label view "${name}" --repo "${REPO}"`);
    return true;
  } catch {
    const def = labelDefs[name];
    if (!def) return false;
    try {
      sh(`gh label create "${name}" --color "${def.color}" --description "${def.description}" --repo "${REPO}"`);
      console.log(`  ✓ created missing label: ${name}`);
      return true;
    } catch (err) {
      console.warn(`  ! could not create label '${name}': ${err.message?.split('\n')[0]}`);
      return false;
    }
  }
}

const availableLabels = WANTED_LABELS.filter(ensureLabel);
const labelArg = availableLabels.length ? ` --label "${availableLabels.join(',')}"` : '';

try {
  execSync(`gh issue create --repo "${REPO}" --title "${TITLE}" --body-file "${tmpFile}"${labelArg}`, { stdio: 'inherit' });
} catch (e) {
  if (labelArg) {
    console.warn('Issue create failed with labels — retrying without labels.');
    try {
      execSync(`gh issue create --repo "${REPO}" --title "${TITLE}" --body-file "${tmpFile}"`, { stdio: 'inherit' });
    } catch (e2) {
      console.error('Could not create issue (even without labels):', e2.message);
      process.exit(1);
    }
  } else {
    console.error('Could not create issue:', e.message);
    process.exit(1);
  }
}

state.lastFiredAt = Date.now();
state.dayDelta = dayDelta;
state.trailingAvg = trailingAvgDelta;
mkdirSync('.github', { recursive: true });
writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));

console.log(`Spike issue created. Cooldown active until ${new Date(state.lastFiredAt + COOLDOWN_MS).toISOString()}`);
