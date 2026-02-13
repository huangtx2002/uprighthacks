#!/usr/bin/env node

/**
 * Mock Sensor Simulator for Upright
 * Simulates realistic Arduino accelerometer data without physical hardware
 * 
 * Usage:
 *   node mock-sensor.js [options]
 * 
 * Options:
 *   --host <host>       Backend host (default: localhost)
 *   --port <port>       Backend port (default: 8003)
 *   --sensor <1|2>      Sensor ID (default: 1)
 *   --scenario <name>   Posture scenario (default: mixed)
 *   --hz <rate>         Sample rate in Hz (default: 20)
 * 
 * Scenarios:
 *   good       - Good posture throughout
 *   bad        - Bad posture (slouching)
 *   mixed      - Alternates between good and bad
 *   realistic  - Natural variation with occasional slouching
 *   gradual    - Slowly deteriorates over time
 */

const http = require('http');

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (flag, defaultValue) => {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : defaultValue;
};

const HOST = getArg('--host', 'localhost');
const PORT = parseInt(getArg('--port', '8003'), 10);
const SENSOR = parseInt(getArg('--sensor', '1'), 10);
const SCENARIO = getArg('--scenario', 'realistic');
const HZ = parseInt(getArg('--hz', '20'), 10);
const INTERVAL_MS = 1000 / HZ;

const ENDPOINT = SENSOR === 1 ? '/imu' : '/imu2';

console.log(`
┌─────────────────────────────────────────────────┐
│       🤖 Mock Sensor Simulator v1.0             │
├─────────────────────────────────────────────────┤
│  Sensor:    #${SENSOR}                                │
│  Endpoint:  http://${HOST}:${PORT}${ENDPOINT}       │
│  Scenario:  ${SCENARIO.padEnd(35)} │
│  Rate:      ${HZ} Hz (${INTERVAL_MS}ms interval)          │
└─────────────────────────────────────────────────┘
`);

// Posture scenarios configuration
const SCENARIOS = {
  good: {
    basePitch: 5,      // Near-vertical (good posture)
    pitchRange: 3,     // Small variation
    slouchChance: 0,   // No slouching
    description: 'Perfect posture maintained'
  },
  bad: {
    basePitch: 25,     // Forward tilt (slouching)
    pitchRange: 5,
    slouchChance: 1,   // Always slouching
    description: 'Continuous slouching'
  },
  mixed: {
    basePitch: 10,
    pitchRange: 15,
    slouchChance: 0.5, // 50% slouch
    cycleSeconds: 30,  // Switch every 60 seconds (was 30)
    description: 'Alternating good and bad posture'
  },
  realistic: {
    basePitch: 8,
    pitchRange: 12,
    slouchChance: 0.3, // 30% slouch
    driftRate: 0.01,   // Slow drift over time
    description: 'Natural posture with occasional slouching'
  },
  gradual: {
    basePitch: 5,
    pitchRange: 8,
    slouchChance: 0,
    deteriorationRate: 0.05, // Gradually gets worse
    description: 'Posture slowly deteriorates over time'
  }
};

// Get scenario config
const config = SCENARIOS[SCENARIO] || SCENARIOS.realistic;

// State
let timestamp = Date.now();
let previousPitch = config.basePitch;
let previousPitchSmooth = config.basePitch;
let driftOffset = 0;
let deterioration = 0;
let sampleCount = 0;

// Helper: Generate random value in range
function randomInRange(min, max) {
  return min + Math.random() * (max - min);
}

// Helper: Smooth value using exponential moving average
function ema(prev, curr, alpha = 0.25) {
  return alpha * curr + (1.0 - alpha) * prev;
}

// Generate realistic acceleration values for a given pitch
function generateAcceleration(pitch, roll) {
  const pitchRad = pitch * Math.PI / 180;
  const rollRad = roll * Math.PI / 180;
  
  // Approximate accelerometer readings
  const ax = -Math.sin(pitchRad);
  const ay = Math.sin(rollRad) * Math.cos(pitchRad);
  const az = Math.cos(pitchRad) * Math.cos(rollRad);
  
  // Add small noise
  const noise = 0.02;
  return {
    ax: ax + randomInRange(-noise, noise),
    ay: ay + randomInRange(-noise, noise),
    az: az + randomInRange(-noise, noise)
  };
}

// Generate a sample based on scenario
function generateSample() {
  const now = Date.now();
  const dt = (now - timestamp) / 1000;
  timestamp = now;
  sampleCount++;
  
  // Calculate base pitch based on scenario
  let targetPitch = config.basePitch;
  
  // Apply scenario-specific logic
  if (SCENARIO === 'mixed') {
    // Cycle between good and bad
    const cycle = Math.floor(sampleCount / (config.cycleSeconds * HZ));
    const isGoodPhase = cycle % 2 === 0;
    targetPitch = isGoodPhase ? 5 : 20;
  } else if (SCENARIO === 'gradual') {
    // Gradually increase pitch (deteriorating posture)
    deterioration += config.deteriorationRate;
    targetPitch = config.basePitch + deterioration;
  } else if (SCENARIO === 'realistic') {
    // Natural drift with occasional slouch spikes
    driftOffset += randomInRange(-config.driftRate, config.driftRate);
    driftOffset = Math.max(-5, Math.min(5, driftOffset)); // Clamp
    
    // Random slouch events
    if (Math.random() < config.slouchChance * 0.01) { // Low probability per sample
      targetPitch = config.basePitch + 15 + randomInRange(0, 10);
    } else {
      targetPitch = config.basePitch + driftOffset;
    }
  }
  
  // Add natural variation
  const variation = randomInRange(-config.pitchRange / 2, config.pitchRange / 2);
  const pitch = targetPitch + variation;
  
  // Smooth pitch (EMA filter)
  const pitchSmooth = ema(previousPitchSmooth, pitch, 0.25);
  
  // Calculate pitch rate of change
  const dpitch = dt > 0 ? (pitch - previousPitch) / dt : 0;
  
  // Generate roll (side-to-side tilt) - usually small
  const roll = randomInRange(-3, 3);
  
  // Generate acceleration values
  const { ax, ay, az } = generateAcceleration(pitch, roll);
  const a_mag = Math.sqrt(ax * ax + ay * ay + az * az);
  
  // Update previous values
  previousPitch = pitch;
  previousPitchSmooth = pitchSmooth;
  
  return {
    ax: parseFloat(ax.toFixed(4)),
    ay: parseFloat(ay.toFixed(4)),
    az: parseFloat(az.toFixed(4)),
    pitch: parseFloat(pitch.toFixed(2)),
    pitch_smooth: parseFloat(pitchSmooth.toFixed(2)),
    roll: parseFloat(roll.toFixed(2)),
    a_mag: parseFloat(a_mag.toFixed(4)),
    dpitch: parseFloat(dpitch.toFixed(2)),
    ts: timestamp
  };
}

// Post sample to backend
function postSample(sample) {
  const payload = JSON.stringify(sample);
  
  const options = {
    hostname: HOST,
    port: PORT,
    path: ENDPOINT,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };
  
  const req = http.request(options, (res) => {
    if (res.statusCode === 200) {
      // Success - log occasionally
      if (sampleCount % (HZ * 5) === 0) { // Every 5 seconds
        const status = sample.pitch >= 15 ? '🔴 SLOUCH' : '🟢 GOOD';
        console.log(`[${new Date().toLocaleTimeString()}] ${status} | Pitch: ${sample.pitch.toFixed(1)}° | Samples: ${sampleCount}`);
      }
    } else {
      console.error(`❌ HTTP ${res.statusCode}`);
    }
  });
  
  req.on('error', (err) => {
    console.error(`❌ Request failed: ${err.message}`);
  });
  
  req.write(payload);
  req.end();
}

// Simulate calibration event at startup
function sendCalibrationEvent() {
  const event = {
    event: 'calibration',
    baseline_pitch: config.basePitch,
    samples: 5,
    ts: Date.now()
  };
  
  const payload = JSON.stringify(event);
  
  const options = {
    hostname: HOST,
    port: PORT,
    path: ENDPOINT,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };
  
  const req = http.request(options, (res) => {
    if (res.statusCode === 200) {
      console.log(`✅ Calibration event sent (baseline: ${config.basePitch}°)`);
    }
  });
  
  req.on('error', () => {});
  req.write(payload);
  req.end();
}

// Main loop
console.log(`📡 Starting sensor simulation: ${config.description}`);
console.log(`⏱️  Sending samples every ${INTERVAL_MS}ms...\n`);

// Send initial calibration
setTimeout(sendCalibrationEvent, 1000);

// Start sampling loop
setInterval(() => {
  const sample = generateSample();
  postSample(sample);
}, INTERVAL_MS);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down mock sensor...');
  console.log(`📊 Total samples sent: ${sampleCount}`);
  console.log(`⏱️  Runtime: ${Math.floor(sampleCount / HZ)}s\n`);
  process.exit(0);
});
