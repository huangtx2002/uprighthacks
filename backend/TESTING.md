# Testing Insights Feature

The insight system has been configured for **10-second windows** for testing purposes.

## Quick Start

### 1. Start the Backend Server

```bash
cd backend
npm install  # if not already done
npm start
```

You should see:
```
Backend listening on http://localhost:8080
WebSocket on ws://localhost:8080
```

### 2. Test with Script (Easiest)

Run the test script that sends sample data:

```bash
cd backend
node test-insights.js
```

This script:
- Sends 10 "good posture" samples (low pitch)
- Sends 10 "slouching" samples (high pitch)
- **Wait ~10 seconds** for the window to close and an insight to be generated

Watch the server console for messages like:
```
[Window] Processed 2026-01-11T...: rating=good, confidence=medium
```

### 3. Test with Manual curl Commands

#### Send sample data:

```bash
# Send a good posture sample
curl -X POST -H "Content-Type: application/json" \
  --data '{"pitch":5,"pitch_smooth":5,"roll":0,"ts":'$(date +%s000)'}' \
  http://localhost:8080/imu

# Send a slouching sample
curl -X POST -H "Content-Type: application/json" \
  --data '{"pitch":25,"pitch_smooth":25,"roll":0,"ts":'$(date +%s000)'}' \
  http://localhost:8080/imu
```

#### Send multiple samples to fill a window:

```bash
# Send 20 samples with varying pitch values
for i in {1..20}; do
  pitch=$((5 + $i % 20))
  curl -X POST -H "Content-Type: application/json" \
    --data "{\"pitch\":$pitch,\"pitch_smooth\":$pitch,\"roll\":0,\"ts\":$(date +%s000)}" \
    http://localhost:8080/imu
  sleep 0.5
done
```

**Important**: You need to wait **10 seconds** after sending samples to a window for it to close and generate an insight. The insight is generated when a new sample arrives that crosses into a new 10-second window boundary.

### 4. Check Insights via HTTP

```bash
# Get latest insight
curl http://localhost:8080/insights/latest

# Get insight history
curl http://localhost:8080/insights/history
```

### 5. Test with WebSocket (Real-time)

Use a WebSocket client to connect to `ws://localhost:8080` and watch for `insight_update` messages.

You can use:
- Browser DevTools: Open console and run:
  ```javascript
  const ws = new WebSocket('ws://localhost:8080');
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'insight_update') {
      console.log('New insight:', msg);
    }
  };
  ```

- Or use a tool like `wscat`:
  ```bash
  npm install -g wscat
  wscat -c ws://localhost:8080
  ```

## Understanding Window Timing

- **Windows are 10 seconds long**
- Windows align to 10-second boundaries (00:00-00:09, 00:10-00:19, 00:20-00:29, etc.)
- An insight is generated when:
  1. A new sample arrives that crosses into a new window
  2. The previous window had at least some samples
  3. The system processes the closed window and generates an insight

## Testing Workflow

1. **Start server**: `npm start` in the `backend` directory
2. **Send samples**: Use the test script or curl commands
3. **Wait ~10 seconds**: For the window boundary to cross
4. **Send one more sample**: To trigger window closure
5. **Check results**: Look at server console, HTTP endpoint, or WebSocket client

## Expected Behavior

- Server console will show: `[Window] Processed <windowId>: rating=<rating>, confidence=<confidence>`
- WebSocket clients will receive `insight_update` messages
- HTTP endpoints will return the latest insight
- The SwiftUI frontend (if connected) will automatically update with the new insight

## Tips

- The first insight may take 10+ seconds (need to fill a window and cross the boundary)
- Subsequent insights come every 10 seconds if you keep sending data
- If Gemini API key is not set, you'll get fallback insights (still useful for testing)
- Check server logs for any errors in insight generation
