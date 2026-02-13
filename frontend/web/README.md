# Upright Web Frontend

Browser-based 3D posture visualization - no hardware required!

## Quick Start

### 1. Start the Backend
```bash
cd ../../backend
npm start
```

### 2. Start Mock Sensors
In separate terminals:
```bash
# Terminal 1
node mock-sensor.js --sensor 1 --scenario realistic

# Terminal 2
node mock-sensor.js --sensor 2 --scenario realistic
```

### 3. Open Web App

**Option A: Direct File**
```bash
open index.html
```

**Option B: Local Server (Recommended)**
```bash
python3 -m http.server 5373
# Visit: http://localhost:5373
```

**Option C: Node.js Server**
```bash
npx http-server -p 5373
# Visit: http://localhost:5373
```

## Features

- 🎨 **Beautiful UI** - Modern gradient design with glassmorphism
- 🎮 **3D Visualization** - Three.js rendered torso with real-time rotation
- 🟢🔴 **Visual Feedback** - Color-coded back glow (green = good, red = bad)
- 📊 **Live Metrics** - Upper/lower pitch, difference, sample count
- 💡 **AI Insights** - Real-time posture analysis from Google Gemini
- 📱 **Responsive** - Works on desktop, tablet, and mobile
- 🔌 **Real-time** - WebSocket connection for instant updates

## Files

- `index.html` - Main web page with UI layout
- `app.js` - JavaScript application logic and 3D rendering

## Configuration

### Change WebSocket URL

Edit `app.js` line 5:
```javascript
const WS_URL = 'ws://localhost:8003';  // Local
// or
const WS_URL = 'ws://your-domain.com:8003';  // Production
```

### Change Posture Threshold

Edit `app.js` line 6:
```javascript
const SLOUCH_THRESHOLD = 15;  // degrees
```

## Technology

- **Three.js** - 3D graphics (WebGL)
- **WebSocket** - Real-time communication
- **HTML5 + CSS3** - Modern web standards
- **Vanilla JavaScript** - No frameworks, just works

## Browser Support

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## Troubleshooting

### "Connecting..." Forever
- Check backend is running: `curl http://localhost:8003`
- Check browser console for errors (F12)
- Verify WebSocket URL in `app.js`

### No 3D Model
- Check Three.js loaded: View page source, look for CDN link
- Check browser console for WebGL errors
- Try different browser

### No Data Updates
- Check mock sensors are running
- View backend logs for incoming data
- Check browser Network tab for WebSocket connection

## Deploy to Production

See [../../DEPLOYMENT.md](../../DEPLOYMENT.md) for complete deployment guide.

---

**Simple, beautiful, and works everywhere!** 🚀
