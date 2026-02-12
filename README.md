# Project: DeltaHacks 12 — Upright (a 3D posture visualizer)

## Built with:
Arduino microcontrollers with MMA7660 accelerometers

Node.js backend with WebSocket for real-time data streaming

Swift Playground, SwiftUI + SceneKit for immersive 3D digital twin visualization

Google Gemini API for intelligent posture analysis and personalized feedback

Custom posture detection algorithms

## About
People around the world are affected by back pain at any one time. For many, poor posture is the silent culprit; hours spent hunched over laptops, craning necks at screens, and slouching in chairs compound into chronic pain that impacts quality of life. Despite its prevalence, real-time posture monitoring remains a severely under-researched problem, with few accessible solutions for everyday prevention.

Upright is a real-time posture monitoring system that helps prevent back pain before it starts. Using dual Arduino sensors with accelerometers placed on the upper back (neck) and lower back, our system detects misalignment between your spine segments—the telltale sign of slouching or poor posture.

When your posture deteriorates, you get instant visual feedback through our digital twin interface- a 3D representation of your torso that mirrors your real-time body positioning. The system compares the angle difference between your upper and lower back sensors in real-time, alerting you when they drift more than 15 degrees apart. But we don't just tell you your posture is bad- powered by Google's Gemini API, Upright provides personalized, actionable feedback and corrective exercises tailored to your specific posture issues, helping you understand not just what's wrong, but how to fix it.

Software engineers, designers, and tech professionals spend 8+ hours a day sitting at desks, making them particularly vulnerable to posture-related injuries. Upright is designed for the people who need it most: those of us who code, design, and build while our backs silently suffer.

## Why it matters:
Prevention is better than cure. By catching poor posture in the moment through digital twin technology and AI-powered insights, Upright helps users develop lasting awareness and healthier habits, potentially saving millions from chronic back pain and its associated costs.

Your spine will thank you. :)

## Overview:

- Express + WebSocket server that accepts 3-axis accelerometer and events from two Arduino devices.
- A serial bridge script forwards JSON lines from an Arduino over serial to the server via HTTP POST.
- Incoming samples and events are appended to newline-delimited JSON log files (`ndjson`) and broadcast to WebSocket clients.

## Key files:

- `server.js`: Main backend. Endpoints:
  - `POST /3-axis accelerometer` (source 1) and `POST /3-axis accelerometer` (source 2) — accept samples (must include numeric `pitch`) or events (`event` string).
  - `GET /latest1`, `GET /latest2` — return most recent sample per source.
  - `GET /history1`, `GET /history2` — return buffered history arrays.
  - WebSocket server broadcasts each incoming object to connected clients.
- `serial-bridge.js`: Serial-to-HTTP bridge. Usage:
  - `node serial-bridge.js <PORT_NAME> [BAUD] [HOST] [PORT] [PATH]`
  - Example: `node serial-bridge.js /dev/ttyUSB0 115200 localhost 8080 /imu`
  - Reads newline JSON from serial, validates, and posts to backend.
- `arduino_code.cpp`: Arduino sketch (MMA7660 accelerometer). Emits JSON lines with fields like `ax`, `ay`, `az`, `pitch`, `pitch_smooth`, `roll`, `a_mag`, `dpitch`, `ts` at ~20Hz.
- `telemetry.ndjson`, `telemetry2.ndjson`: Append-only logs where each line is a JSON object (sample or event).

## Setup & run (backend):

1. Install dependencies: `npm install`
2. Start server: `npm run start` (or `npm run dev` for nodemon)
3. Optionally run serial bridge to forward Arduino data to the server.

## API notes & testing:

- To post a sample manually:
  - `curl -X POST -H "Content-Type: application/json" --data '{"pitch":10}' http://localhost:8080/imu`
- To post an event:
  - `curl -X POST -H "Content-Type: application/json" --data '{"event":"button_click","ts":123456}' http://localhost:8080/imu`
- WebSocket URL: `ws://localhost:8080` — clients receive sample/event JSON objects in real time.

## Arduino notes:

- Uses Grove MMA7660 (I2C). The sketch prints JSON per sample and supports a button-triggered calibration described in the Arduino README.

## Telemetry format:

- Newline-delimited JSON (`ndjson`) — each line contains `kind: "sample"` or `kind: "event"` and a `source` field.

## Developer tips:

- Tail logs: `tail -f telemetry.ndjson`
- Run the server locally before starting the serial bridge.
- For debugging, inspect console logs from `serial-bridge.js` and `server.js`.
