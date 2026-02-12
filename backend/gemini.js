// gemini.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable: ${name}`);
  return v;
}

function makeGeminiClient() {
  const apiKey = requireEnv("GEMINI_API_KEY");
  const modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });

  return { model, modelName };
}

// Turn raw pitch samples into a compact "analysis-ready" text blob.
function buildTelemetrySummary(samples) {
  if (!samples.length) return "No samples available.";

  const pitches = samples
    .map((s) => s.pitch)
    .filter((p) => typeof p === "number" && Number.isFinite(p));

  if (!pitches.length) return "No numeric pitch samples available.";

  const n = pitches.length;
  const min = Math.min(...pitches);
  const max = Math.max(...pitches);
  const avg = pitches.reduce((a, b) => a + b, 0) / n;

  // "slouch-ish" heuristic — adjust threshold to your project
  const SLOUCH_DEG = 15;
  const slouchCount = pitches.filter((p) => p >= SLOUCH_DEG).length;
  const slouchPct = (slouchCount / n) * 100;

  // last sample info
  const last = samples[samples.length - 1];

  return [
    `Samples: ${n}`,
    `Pitch(deg): min=${min.toFixed(2)} avg=${avg.toFixed(2)} max=${max.toFixed(2)}`,
    `Heuristic: slouch>=${SLOUCH_DEG}deg for ${slouchPct.toFixed(1)}% of samples`,
    `Latest: pitch=${Number(last.pitch).toFixed(2)} ts=${last.ts}`,
  ].join("\n");
}

/**
 * Build a summary text from window features (for Gemini analysis).
 */
function buildFeatureSummary(features) {
  const { windowStart, windowEnd, sensor1, sensor2, alignment, quality, slouchThresholdDeg } = features;
  
  const lines = [
    `Window: ${new Date(windowStart).toLocaleString()} - ${new Date(windowEnd).toLocaleString()}`,
    "",
    "Sensor 1 (Upper):",
    sensor1.hasData
      ? `  Samples: ${sensor1.sampleCount}, Mean pitch: ${sensor1.meanPitch}°, Range: [${sensor1.minPitch}°, ${sensor1.maxPitch}°], Slouch: ${sensor1.slouchPercent}%`
      : "  No data",
    "",
    "Sensor 2 (Lower):",
    sensor2.hasData
      ? `  Samples: ${sensor2.sampleCount}, Mean pitch: ${sensor2.meanPitch}°, Range: [${sensor2.minPitch}°, ${sensor2.maxPitch}°], Slouch: ${sensor2.slouchPercent}%`
      : "  No data",
    "",
    "Cross-sensor alignment:",
    alignment.bothActive
      ? `  Pitch difference: ${alignment.pitchDifference}°, Alignment score: ${alignment.alignmentScore}/100`
      : "  Only one sensor active",
    "",
    `Data quality: ${quality.dataQuality}${quality.lowSamples ? " (low sample count)" : ""}`,
    `Slouch threshold: >=${slouchThresholdDeg}°`,
  ];
  
  return lines.join("\n");
}

async function runGemini({ systemPrompt, userPrompt }) {
  const { model } = makeGeminiClient();

  // Gemini SDK supports a single prompt string.
  // We “simulate” system+user by clearly separating them:
  const combined = [
    "SYSTEM INSTRUCTIONS:",
    systemPrompt,
    "",
    "USER REQUEST:",
    userPrompt,
  ].join("\n");

  const result = await model.generateContent(combined);
  const text = result?.response?.text?.() ?? "";
  return text.trim();
}

/**
 * Generate insight from window features using Gemini.
 */
async function generateInsight(features) {
  const featureSummary = buildFeatureSummary(features);
  
  const SLOUCH_DEG = features.slouchThresholdDeg || 15;
  
  const systemPrompt = [
    "You are an assistant analyzing posture telemetry from a wearable IMU.",
    "You must return STRICT JSON only (no markdown, no extra commentary).",
    "Your job: summarize posture quality and provide actionable insights.",
    "",
    "JSON schema:",
    "{",
    '  "rating": "good" | "fair" | "poor",',
    '  "summary": "1-2 sentence summary of the window",',
    '  "issues": ["issue1", "issue2", ...],',
    '  "suggestions": ["suggestion1", "suggestion2", ...],',
    '  "tip": "one actionable tip",',
    '  "confidence": "low" | "medium" | "high"',
    "}",
    "",
    "Rules:",
    "- Keep it concise (max 5 issues, max 5 suggestions).",
    "- If samples are few or noisy, lower confidence.",
    "- Do not mention medical diagnosis. This is educational feedback only.",
    "- DO NOT mention angles, degrees, or numeric thresholds (no '>=', '<', '°').",
    "- Focus on natural language: 'slouching', 'lean', 'good alignment', etc.",
    "- Keep language friendly and accessible, avoid technical measurements.",
    "- Rating: good = low slouch, fair = moderate slouch, poor = frequent slouching",
  ].join("\n");

  const userPrompt = [
    `Analyze the posture telemetry features below and produce JSON using the schema.`,
    "",
    "Window features:",
    featureSummary,
  ].join("\n");

  const raw = await runGemini({ systemPrompt, userPrompt });
  
  // Parse JSON, with fallback
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    parsed = null;
  }
  
  // Fallback insight if Gemini parsing fails
  const avgSlouch = features.sensor1.hasData && features.sensor2.hasData
    ? (features.sensor1.slouchPercent + features.sensor2.slouchPercent) / 2
    : features.sensor1.hasData
    ? features.sensor1.slouchPercent
    : features.sensor2.hasData
    ? features.sensor2.slouchPercent
    : 0;
  
  // Use the same variation logic as createFallbackInsight
  const totalSamples = features.sensor1.sampleCount + features.sensor2.sampleCount;
  const variation = totalSamples % 4;
  const rating = avgSlouch >= 60 ? "poor" : avgSlouch >= 40 ? "not_so_good" : avgSlouch >= 15 ? "fair" : "good";
  
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
    "You're leaning occasionally",
    "Some slouching detected",
    "Posture could be more consistent",
    "Occasional lean",
  ];
  const issuesNotSoGood = [
    "You're leaning often",
    "Noticeable slouching detected",
    "Posture needs improvement",
    "Regular lean",
  ];
  const issuesPoor = [
    "You're slouching frequently",
    "Frequent lean detected",
    "Posture needs significant improvement",
    "Persistent slouching",
  ];
  
  const suggestionsFair = [
    "Try a 20–30s posture reset: shoulders back, chin neutral, sit tall",
    "Take breaks to check your posture and straighten up",
    "Adjust your screen height so you can see without leaning",
    "Consider using lumbar support to help maintain alignment",
  ];
  
  const suggestionsNotSoGood = [
    "Take breaks to reset your posture: shoulders back, chin neutral, sit tall",
    "Raise your screen to eye level to reduce lean",
    "Use lumbar support and adjust your chair height",
    "Set reminders to check and correct your posture every 15 minutes",
  ];
  
  const suggestionsPoor = [
    "Take frequent breaks to reset your posture: shoulders back, chin neutral",
    "Raise your screen to eye level to reduce lean",
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
    "Be more mindful of when you start to lean",
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
  
  const fallback = {
    rating: rating,
    summary: summaries[rating][variation],
    issues: rating === "good" ? issuesGood : rating === "fair" ? [issuesFair[variation]] : rating === "not_so_good" ? [issuesNotSoGood[variation]] : [issuesPoor[variation]],
    suggestions: rating === "good" ? ["Keep maintaining good posture!"] : rating === "fair" ? [suggestionsFair[variation], suggestionsFair[(variation + 1) % suggestionsFair.length]] : rating === "not_so_good" ? [suggestionsNotSoGood[variation], suggestionsNotSoGood[(variation + 1) % suggestionsNotSoGood.length]] : [suggestionsPoor[variation], suggestionsPoor[(variation + 1) % suggestionsPoor.length]],
    tip: rating === "good" ? tipsGood[variation] : rating === "fair" ? tipsFair[variation] : rating === "not_so_good" ? tipsNotSoGood[variation] : tipsPoor[variation],
    confidence: features.quality.dataQuality === "good" ? "high" : features.quality.dataQuality === "partial" ? "medium" : "low",
  };
  
  return parsed ?? fallback;
}

module.exports = {
  buildTelemetrySummary,
  buildFeatureSummary,
  runGemini,
  generateInsight,
};
