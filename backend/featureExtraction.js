// featureExtraction.js
// Extract features from window samples for Gemini analysis

const SLOUCH_DEG = Number(process.env.SLOUCH_DEG || 15);

/**
 * Compute statistics for a single sensor's samples.
 */
function computeSensorStats(samples) {
  const pitches = samples
    .map((s) => s.pitch)
    .filter((p) => typeof p === "number" && Number.isFinite(p));
  
  if (pitches.length === 0) {
    return {
      sampleCount: 0,
      meanPitch: null,
      stdDevPitch: null,
      minPitch: null,
      maxPitch: null,
      slouchPercent: 0,
      hasData: false,
    };
  }
  
  const n = pitches.length;
  const mean = pitches.reduce((a, b) => a + b, 0) / n;
  const variance = pitches.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);
  const min = Math.min(...pitches);
  const max = Math.max(...pitches);
  const slouchCount = pitches.filter((p) => p >= SLOUCH_DEG).length;
  const slouchPercent = (slouchCount / n) * 100;
  
  return {
    sampleCount: n,
    meanPitch: Number(mean.toFixed(2)),
    stdDevPitch: Number(stdDev.toFixed(2)),
    minPitch: Number(min.toFixed(2)),
    maxPitch: Number(max.toFixed(2)),
    slouchPercent: Number(slouchPercent.toFixed(1)),
    hasData: true,
  };
}

/**
 * Compute cross-sensor alignment metrics.
 */
function computeAlignmentMetrics(stats1, stats2) {
  if (!stats1.hasData || !stats2.hasData) {
    return {
      pitchDifference: null,
      alignmentScore: null,
      bothActive: false,
    };
  }
  
  const pitchDiff = Math.abs(stats1.meanPitch - stats2.meanPitch);
  // Simple alignment score: closer to 0 difference = better (normalized 0-100)
  const alignmentScore = Math.max(0, 100 - pitchDiff * 5);
  
  return {
    pitchDifference: Number(pitchDiff.toFixed(2)),
    alignmentScore: Number(alignmentScore.toFixed(1)),
    bothActive: true,
  };
}

/**
 * Compute data quality flags.
 */
function computeDataQuality(window, stats1, stats2) {
  // For 15-second windows at ~20Hz, expect ~300 samples. Use 50 as minimum threshold.
  const minSamplesForQuality = 50;
  const lowSamples = stats1.sampleCount < minSamplesForQuality && stats2.sampleCount < minSamplesForQuality;
  const missingSensor1 = !stats1.hasData;
  const missingSensor2 = !stats2.hasData;
  const onlyOneSensor = (stats1.hasData && !stats2.hasData) || (!stats1.hasData && stats2.hasData);
  
  return {
    lowSamples,
    missingSensor1,
    missingSensor2,
    onlyOneSensor,
    dataQuality: lowSamples ? "low" : onlyOneSensor ? "partial" : "good",
  };
}

/**
 * Compute comprehensive features for a window.
 */
function computeWindowFeatures(window) {
  const stats1 = computeSensorStats(window.sensor1);
  const stats2 = computeSensorStats(window.sensor2);
  const alignment = computeAlignmentMetrics(stats1, stats2);
  const quality = computeDataQuality(window, stats1, stats2);
  
  return {
    windowStart: new Date(window.start).toISOString(),
    windowEnd: new Date(window.end).toISOString(),
    sensor1: stats1,
    sensor2: stats2,
    alignment,
    quality,
    slouchThresholdDeg: SLOUCH_DEG,
  };
}

module.exports = {
  computeWindowFeatures,
  computeSensorStats,
  SLOUCH_DEG,
};
