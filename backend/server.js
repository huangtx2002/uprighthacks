// server.js
const path = require("path");

// Load environment variables from your custom env file
require("dotenv").config({
  path: path.join(__dirname, "Gemini-Integration-Key.env"),
});

const http = require("http");
const express = require("express");
const cors = require("cors");
const WebSocket = require("ws");
const fs = require("fs");

// Gemini helpers
const { buildTelemetrySummary, runGemini, generateInsight } = require("./gemini");
// Window management and feature extraction
const { WindowManager } = require("./windowManager");
const { computeWindowFeatures } = require("./featureExtraction");

const PORT = Number(process.env.PORT || 8080);

const app = express();
app.use(cors());
app.use(express.json({ limit: "256kb" }));

const TELEMETRY1_PATH =
  process.env.TELEMETRY1_PATH || path.join(__dirname, "telemetry.ndjson");
const TELEMETRY2_PATH =
  process.env.TELEMETRY2_PATH || path.join(__dirname, "telemetry2.ndjson");

const MAX_BUFFER = Number(process.env.MAX_BUFFER || 2000);
let history1 = [];
let history2 = [];

let latest1 = { pitch: 0, ts: Date.now(), source: 1 };
let latest2 = { pitch: 0, ts: Date.now(), source: 2 };

// Window manager for 15-second insights
const windowManager = new WindowManager();

// Insight storage (in-memory)
let latestInsight = null;
const insightHistory = []; // Last ~240 windows (60 minutes of 15-second windows)
const MAX_INSIGHT_HISTORY = 240;

// Track processed windows to prevent duplicates
const processedWindows = new Set();

// ---- Gemini config knobs (safe defaults) ----
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";
const ANALYSIS_DEFAULT_WINDOW = Number(process.env.ANALYSIS_WINDOW || 300); // samples
const ANALYSIS_MAX_WINDOW = Number(process.env.ANALYSIS_MAX_WINDOW || 1000);
const SLOUCH_DEG = Number(process.env.SLOUCH_DEG || 15);

// warn if the Gemini key is missing (doesn't break telemetry server)
if (!process.env.GEMINI_API_KEY) {
  console.warn(
    "[WARN] GEMINI_API_KEY is not set. Add GEMINI_API_KEY=... to backend/Gemini-Integration-Key.env if using Gemini."
  );
}

function toNum(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)))
    return Number(v);
  return undefined;
}

function appendNdjson(filePath, obj) {
  fs.appendFile(filePath, JSON.stringify(obj) + "\n", () => {});
}

function normalizeSample(body) {
  const pitch = toNum(body?.pitch);
  if (pitch === undefined) return { ok: false, error: "pitch must be a number" };

  // Ensure every sample has a timestamp
  const ts = toNum(body?.ts) ?? Date.now();

  const sample = {
    kind: "sample",
    ax: toNum(body?.ax),
    ay: toNum(body?.ay),
    az: toNum(body?.az),
    pitch,
    pitch_smooth: toNum(body?.pitch_smooth),
    roll: toNum(body?.roll),
    a_mag: toNum(body?.a_mag),
    dpitch: toNum(body?.dpitch),
    baseline_pitch: toNum(body?.baseline_pitch),
    button: toNum(body?.button),
    button_click: toNum(body?.button_click),
    ts,
  };

  return { ok: true, msg: sample };
}

function normalizeEvent(body) {
  const event = typeof body?.event === "string" ? body.event : undefined;
  if (!event) return { ok: false, error: "event must be a string" };

  const ts = toNum(body?.ts) ?? Date.now();
  const msg = { ...body, kind: "event", ts };

  return { ok: true, msg };
}

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  }
}

wss.on("connection", (ws) => {
  ws.send(JSON.stringify(latest1));
  ws.send(JSON.stringify(latest2));
  // Send latest insight if available
  if (latestInsight) {
    ws.send(JSON.stringify(latestInsight));
  }
});

/**
 * Process a closed window: compute features, generate insight, broadcast.
 */
async function processClosedWindow(closedWindowId) {
  try {
    // Prevent duplicate processing - if we've already processed this window, skip it
    if (processedWindows.has(closedWindowId)) {
      console.log(`[Window] Already processed ${closedWindowId}, skipping duplicate`);
      return;
    }
    
    const window = windowManager.getWindow(closedWindowId);
    if (!window) {
      console.log(`[Window] No data for closed window ${closedWindowId}`);
      return;
    }

    // Check minimum sample threshold - need at least some data to generate meaningful insights
    const totalSamples = window.sensor1.length + window.sensor2.length;
    const MIN_SAMPLES_THRESHOLD = 10; // Minimum samples before processing
    
    if (totalSamples < MIN_SAMPLES_THRESHOLD) {
      console.log(`[Window] Insufficient samples (${totalSamples}) for ${closedWindowId}, skipping`);
      // Mark as processed anyway to avoid retrying
      processedWindows.add(closedWindowId);
      return;
    }

    // Mark as being processed immediately to prevent race conditions
    processedWindows.add(closedWindowId);
    
    // Clean up old processed window IDs (keep last 500)
    if (processedWindows.size > 500) {
      const toRemove = Array.from(processedWindows).slice(0, processedWindows.size - 500);
      toRemove.forEach(id => processedWindows.delete(id));
    }

    // Compute features from window samples
    const features = computeWindowFeatures(window);
    
    // Generate insight using Gemini (if API key available)
    let insight = null;
    if (process.env.GEMINI_API_KEY) {
      try {
        insight = await generateInsight(features);
      } catch (err) {
        console.error(`[Window] Gemini error for ${closedWindowId}:`, err.message);
        // Fall back to basic insight
        insight = createFallbackInsight(features);
      }
    } else {
      insight = createFallbackInsight(features);
    }

    // Create insight object
    const insightObj = {
      type: "insight_update",
      windowStart: features.windowStart,
      windowEnd: features.windowEnd,
      rating: insight.rating,
      summary: insight.summary,
      issues: insight.issues || [],
      suggestions: insight.suggestions || [],
      tip: insight.tip,
      confidence: insight.confidence,
      features: {
        sensor1: features.sensor1,
        sensor2: features.sensor2,
        alignment: features.alignment,
        quality: features.quality,
      },
    };

    // Update latest insight and history
    latestInsight = insightObj;
    insightHistory.push(insightObj);
    if (insightHistory.length > MAX_INSIGHT_HISTORY) {
      insightHistory.shift();
    }

    // Broadcast to WebSocket clients (only once per window)
    broadcast(insightObj);
    
    console.log(`[Window] Processed ${closedWindowId}: rating=${insight.rating}, confidence=${insight.confidence}, samples=${totalSamples}`);
    
    // Clean up old windows
    windowManager.trimHistory(240); // Keep last 240 windows (60 minutes of 15-second windows)
    windowManager.removeWindow(closedWindowId);
  } catch (err) {
    console.error(`[Window] Error processing ${closedWindowId}:`, err);
  }
}

/**
 * Create a fallback insight when Gemini is unavailable.
 * Includes variation to avoid repetitive messages.
 */
function createFallbackInsight(features) {
  const avgSlouch = features.sensor1.hasData && features.sensor2.hasData
    ? (features.sensor1.slouchPercent + features.sensor2.slouchPercent) / 2
    : features.sensor1.hasData
    ? features.sensor1.slouchPercent
    : features.sensor2.hasData
    ? features.sensor2.slouchPercent
    : 0;
  
  const totalSamples = features.sensor1.sampleCount + features.sensor2.sampleCount;
  const rating = avgSlouch >= 60 ? "poor" : avgSlouch >= 40 ? "not_so_good" : avgSlouch >= 15 ? "fair" : "good";
  
  // Add variation using a simple hash of sample count
  const variation = totalSamples % 4;
  
  // Different summary variations (without angle references)
  const summaries = {
    good: [
      "Your posture looks excellent! You're maintaining good alignment throughout.",
      "Great job! Your posture is well-aligned and consistent.",
      "Excellent posture maintenance. Keep it up!",
      "Your alignment is looking strong. Well done!",
    ],
    fair: [
      "Your posture could use some attention. You're slouching occasionally.",
      "You're showing some lean. Try to straighten up when you notice it.",
      "Moderate slouching detected. Focus on keeping your shoulders back.",
      "Your posture is okay but could be improved. Be mindful of lean.",
    ],
    not_so_good: [
      "You're slouching noticeably. Try to sit up straighter.",
      "Noticeable lean detected. Make an effort to correct your posture.",
      "You're leaning often. Focus on keeping your back straight.",
      "Your posture needs attention. You're slouching more than usual.",
    ],
    poor: [
      "You're slouching quite often. Try to sit up straighter.",
      "Frequent lean detected. Make an effort to correct your posture.",
      "You're leaning most of the time. Focus on keeping your back straight.",
      "Your posture needs attention. You're slouching regularly.",
    ],
  };
  
  const issuesGood = [];
  const issuesFair = [
    "You're leaning forward occasionally",
    "Some forward slouching detected",
    "Posture could be more consistent",
    "Occasional forward lean",
  ];
  const issuesNotSoGood = [
    "You're leaning forward often",
    "Noticeable forward slouching detected",
    "Posture needs improvement",
    "Regular forward lean",
  ];
  const issuesPoor = [
    "You're slouching forward frequently",
    "Frequent forward lean detected",
    "Posture needs significant improvement",
    "Persistent forward slouching",
  ];
  
  const suggestionsFair = [
    "Try a 20–30s posture reset: shoulders back, chin neutral, sit tall",
    "Take breaks to check your posture and straighten up",
    "Adjust your screen height so you can see without leaning forward",
    "Consider using lumbar support to help maintain alignment",
  ];
  
  const suggestionsNotSoGood = [
    "Take breaks to reset your posture: shoulders back, chin neutral, sit tall",
    "Raise your screen to eye level to reduce forward lean",
    "Use lumbar support and adjust your chair height",
    "Set reminders to check and correct your posture every 15 minutes",
  ];
  
  const suggestionsPoor = [
    "Take frequent breaks to reset your posture: shoulders back, chin neutral",
    "Raise your screen to eye level to reduce forward lean",
    "Use lumbar support and adjust your chair height",
    "Set reminders to check and correct your posture every 15 minutes",
  ];
  
  const tipsGood = [
    "Keep up the great work maintaining good posture!",
    "You're doing well! Continue to be mindful of your alignment.",
    "Excellent posture habits! Keep them up.",
    "Great job! Your consistent good posture is paying off.",
  ];
  
  const tipsFair = [
    "Set a reminder every 15 minutes to check your posture",
    "Try posture exercises to strengthen your back muscles",
    "Be more mindful of when you start to lean forward",
    "Take a quick posture break right now - sit tall!",
  ];
  
  const tipsNotSoGood = [
    "Start by setting a reminder every 15 minutes to check your posture",
    "Try a posture reset right now: sit tall, shoulders back",
    "Consider ergonomic adjustments to your workspace",
    "Focus on small, frequent posture corrections throughout the day",
  ];
  
  const tipsPoor = [
    "Start by setting a reminder every 15 minutes to check your posture",
    "Try a posture reset right now: sit tall, shoulders back",
    "Consider ergonomic adjustments to your workspace",
    "Focus on small, frequent posture corrections throughout the day",
  ];
  
  return {
    rating: rating,
    summary: summaries[rating][variation],
    issues: rating === "good" ? issuesGood : rating === "fair" ? [issuesFair[variation]] : rating === "not_so_good" ? [issuesNotSoGood[variation]] : [issuesPoor[variation]],
    suggestions: rating === "good" ? ["Keep maintaining good posture!"] : rating === "fair" ? [suggestionsFair[variation], suggestionsFair[(variation + 1) % suggestionsFair.length]] : rating === "not_so_good" ? [suggestionsNotSoGood[variation], suggestionsNotSoGood[(variation + 1) % suggestionsNotSoGood.length]] : [suggestionsPoor[variation], suggestionsPoor[(variation + 1) % suggestionsPoor.length]],
    tip: rating === "good" ? tipsGood[variation] : rating === "fair" ? tipsFair[variation] : rating === "not_so_good" ? tipsNotSoGood[variation] : tipsPoor[variation],
    confidence: features.quality.dataQuality === "good" ? "high" : features.quality.dataQuality === "partial" ? "medium" : "low",
  };
}

function handleIncoming(reqBody, source, telemetryPath, historyArr, setLatest) {
  if (typeof reqBody?.event === "string") {
    const norm = normalizeEvent(reqBody);
    if (!norm.ok) return { ok: false, status: 400, payload: norm };

    const msg = { ...norm.msg, source };
    appendNdjson(telemetryPath, msg);
    broadcast(msg);

    historyArr.push(msg);
    if (historyArr.length > MAX_BUFFER) historyArr.shift();

    return { ok: true, status: 200, payload: { ok: true } };
  }

  const norm = normalizeSample(reqBody);
  if (!norm.ok) return { ok: false, status: 400, payload: norm };

  const msg = { ...norm.msg, source };
  setLatest(msg);

  appendNdjson(telemetryPath, msg);
  broadcast(msg);

  historyArr.push(msg);
  if (historyArr.length > MAX_BUFFER) historyArr.shift();

  // Ingest sample into window manager and check if a window closed
  const closedWindowId = windowManager.ingestSample(source, msg);
  if (closedWindowId) {
    // Process the closed window asynchronously (don't block the request)
    processClosedWindow(closedWindowId).catch((err) => {
      console.error(`[Window] Async error processing ${closedWindowId}:`, err);
    });
  }

  return { ok: true, status: 200, payload: { ok: true } };
}

// Arduino #1
app.post("/imu", (req, res) => {
  const out = handleIncoming(req.body, 1, TELEMETRY1_PATH, history1, (m) => (latest1 = m));
  res.status(out.status).json(out.payload);
});

// Arduino #2
app.post("/imu2", (req, res) => {
  const out = handleIncoming(req.body, 2, TELEMETRY2_PATH, history2, (m) => (latest2 = m));
  res.status(out.status).json(out.payload);
});

app.get("/latest1", (req, res) => res.json(latest1));
app.get("/latest2", (req, res) => res.json(latest2));
app.get("/history1", (req, res) => res.json(history1));
app.get("/history2", (req, res) => res.json(history2));

// Insight endpoints
app.get("/insights/latest", (req, res) => {
  res.json(latestInsight || { error: "No insights yet" });
});

app.get("/insights/history", (req, res) => {
  res.json(insightHistory);
});

/**
 * Gemini Health Check
 * Confirms your backend can "see" GEMINI_API_KEY and what model it will use.
 */
app.get("/gemini/health", (req, res) => {
  res.json({
    ok: true,
    hasKey: Boolean(process.env.GEMINI_API_KEY),
    model: GEMINI_MODEL,
  });
});

// Gemini-powered posture analysis endpoint
app.post("/gemini/analyze", async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(400).json({
        ok: false,
        error: "GEMINI_API_KEY missing. Add it to backend/Gemini-Integration-Key.env",
      });
    }

    const windowReq = toNum(req.body?.window) ?? ANALYSIS_DEFAULT_WINDOW;
    const window = Math.max(20, Math.min(ANALYSIS_MAX_WINDOW, Math.floor(windowReq)));

    const source = req.body?.source ?? "both";

    const pickWindow = (arr) => arr.slice(Math.max(0, arr.length - window));

    const s1 = pickWindow(history1).filter((x) => x.kind === "sample");
    const s2 = pickWindow(history2).filter((x) => x.kind === "sample");

    let combinedSamples = [];
    if (source === 1 || source === "1") combinedSamples = s1;
    else if (source === 2 || source === "2") combinedSamples = s2;
    else combinedSamples = [...s1, ...s2].sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0));

    // basic fallback stats for Gemini analysis
    const pitches = combinedSamples
      .map((s) => s.pitch)
      .filter((p) => typeof p === "number" && Number.isFinite(p));

    const n = pitches.length;
    const min = n ? Math.min(...pitches) : null;
    const max = n ? Math.max(...pitches) : null;
    const avg = n ? pitches.reduce((a, b) => a + b, 0) / n : null;
    const slouchCount = n ? pitches.filter((p) => p >= SLOUCH_DEG).length : 0;
    const slouchPct = n ? (slouchCount / n) * 100 : 0;

    const telemetryText = buildTelemetrySummary(combinedSamples);

    const systemPrompt = [
      "You are an assistant analyzing posture telemetry from a wearable IMU.",
      "You must return STRICT JSON only (no markdown, no extra commentary).",
      "Your job: summarize posture quality and provide actionable insights.",
      "",
      "JSON schema:",
      "{",
      '  "overall": "good|okay|bad",',
      '  "key_findings": ["..."],',
      '  "metrics": {',
      '    "samples": number,',
      '    "pitch_min_deg": number|null,',
      '    "pitch_avg_deg": number|null,',
      '    "pitch_max_deg": number|null,',
      `    "slouch_threshold_deg": ${SLOUCH_DEG},`,
      '    "slouch_percent": number',
      "  },",
      '  "recommendations": ["..."],',
      '  "confidence": "low|medium|high"',
      "}",
      "",
      "Rules:",
      "- Keep it concise (max 5 findings, max 5 recommendations).",
      "- If samples are few or noisy, lower confidence.",
      "- Do not mention medical diagnosis. This is educational feedback only.",
    ].join("\n");

    const userPrompt = [
      `Analyze the posture telemetry below and produce JSON using the schema.`,
      "",
      "Telemetry summary:",
      telemetryText,
    ].join("\n");

    const raw = await runGemini({ systemPrompt, userPrompt });

    // Parse Gemini output as JSON (strict). If parsing fails, return fallback + raw text.
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      parsed = null;
    }

    const fallback = {
      overall:
        slouchPct >= 60 ? "bad" : slouchPct >= 25 ? "okay" : "good",
      key_findings: [
        n ? `Slouching (>=${SLOUCH_DEG}°) for ~${slouchPct.toFixed(1)}% of samples.` : "No valid samples yet.",
      ],
      metrics: {
        samples: n,
        pitch_min_deg: min === null ? null : Number(min.toFixed(2)),
        pitch_avg_deg: avg === null ? null : Number(avg.toFixed(2)),
        pitch_max_deg: max === null ? null : Number(max.toFixed(2)),
        slouch_threshold_deg: SLOUCH_DEG,
        slouch_percent: Number(slouchPct.toFixed(1)),
      },
      recommendations: [
        "Try a 20–30s posture reset: shoulders back, chin neutral, sit tall.",
        "If you’re slouching often, raise your screen to eye level or use lumbar support.",
      ],
      confidence: n >= 120 ? "high" : n >= 40 ? "medium" : "low",
    };

    return res.json({
      ok: true,
      window,
      source,
      gemini_used: true,
      result: parsed ?? fallback,
      // Include raw ONLY if parsing failed (useful for debugging)
      raw_if_unparsed: parsed ? undefined : raw,
    });
  } catch (err) {
    console.error("[/gemini/analyze] Error:", err);
    res.status(500).json({
      ok: false,
      error: err?.message || "Unknown error",
    });
  }
});

app.get("/", (req, res) => {
  res.send(
    `OK\n` +
      `POST /imu (source 1) -> ${path.basename(TELEMETRY1_PATH)}\n` +
      `POST /imu2 (source 2) -> ${path.basename(TELEMETRY2_PATH)}\n` +
      `GET  /gemini/health\n` +
      `POST /gemini/analyze\n` +
      `GET  /insights/latest\n` +
      `GET  /insights/history\n` +
      `WS: ws://localhost:${PORT}\n`
  );
});

server.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
  console.log(`WebSocket on ws://localhost:${PORT}`);
  console.log(`Logging #1 to ${TELEMETRY1_PATH}`);
  console.log(`Logging #2 to ${TELEMETRY2_PATH}`);
  console.log(`Gemini model: ${GEMINI_MODEL}`);
});
