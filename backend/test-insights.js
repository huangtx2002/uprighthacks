#!/usr/bin/env node
// test-insights.js
// Quick test script to send sample data and trigger insight generation
// Run: node test-insights.js

const http = require("http");

const HOST = "localhost";
const PORT = 8003;

// Generate samples with varying pitch values to simulate different postures
function generateSample(pitch, source = 1, offsetMs = 0) {
  const ts = Date.now() + offsetMs;
  return {
    pitch: pitch,
    pitch_smooth: pitch,
    roll: 0,
    ax: 0,
    ay: 0,
    az: 0,
    ts: ts,
  };
}

function postSample(sample, source = 1) {
  const endpoint = source === 1 ? "/imu" : "/imu2";
  const data = JSON.stringify(sample);

  const options = {
    hostname: HOST,
    port: PORT,
    path: endpoint,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(data),
    },
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(body));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function testInsights() {
  console.log("Testing insight generation...");
  console.log("Note: Windows are 10 seconds, so you need to wait ~10 seconds between batches");
  console.log("to trigger window closure and insight generation.\n");

  // Send samples to simulate good posture (low pitch)
  console.log("Sending good posture samples (low pitch)...");
  for (let i = 0; i < 10; i++) {
    const sample = generateSample(5 + Math.random() * 5, 1, i * 100); // 5-10 degrees
    await postSample(sample, 1);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  console.log("✓ Sent 10 good posture samples\n");

  // Wait a moment
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Send samples to simulate slouching (high pitch)
  console.log("Sending slouching samples (high pitch)...");
  for (let i = 0; i < 10; i++) {
    const sample = generateSample(20 + Math.random() * 10, 1, i * 100); // 20-30 degrees
    await postSample(sample, 1);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  console.log("✓ Sent 10 slouching samples\n");

  console.log("Waiting for window to close (10 seconds)...");
  console.log("Watch the server console for '[Window] Processed...' messages");
  console.log("Or check the WebSocket client for insight_update messages");
  console.log("\nTo see latest insight: curl http://localhost:8080/insights/latest");
  console.log("To see history: curl http://localhost:8080/insights/history");
}

// Main execution
testInsights().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
