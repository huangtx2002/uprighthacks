# System Architecture - With Web Demo

## Two Deployment Modes

```
┌────────────────────────────────────────────────────────────────────┐
│                    MODE 1: Hardware Setup                          │
│                   (For Real Posture Monitoring)                    │
└────────────────────────────────────────────────────────────────────┘

    Arduino #1          Arduino #2
    (Upper Back)        (Lower Back)
         │                   │
         │ USB Serial        │ USB Serial
         ▼                   ▼
    serial-bridge.js    serial-bridge.js
         │                   │
         │ HTTP POST         │ HTTP POST
         └────────┬──────────┘
                  ▼
         Backend Server (8003)
                  │
                  │ WebSocket
                  ▼
         Swift App (macOS)
              [SceneKit]


┌────────────────────────────────────────────────────────────────────┐
│                    MODE 2: Web Demo                                │
│              (No Hardware - Browser-Based)                         │
└────────────────────────────────────────────────────────────────────┘

    mock-sensor.js      mock-sensor.js
    --sensor 1          --sensor 2
    (Simulated)         (Simulated)
         │                   │
         │ HTTP POST         │ HTTP POST
         └────────┬──────────┘
                  ▼
         Backend Server (8003)
         ├─ Express (HTTP)
         ├─ WebSocket (WS)
         └─ Gemini AI
                  │
                  │ WebSocket
                  ▼
         Web Browser
         ├─ index.html (UI)
         ├─ app.js (Logic)
         └─ Three.js (3D)


┌────────────────────────────────────────────────────────────────────┐
│              MODE 3: Production Deployment                         │
│            (DigitalOcean with Public Access)                       │
└────────────────────────────────────────────────────────────────────┘

         DigitalOcean Droplet
    ┌──────────────────────────────┐
    │                              │
    │  Nginx (Port 80/443)         │
    │  ├─ Static files (/html)     │
    │  ├─ API proxy (/api)         │
    │  └─ WebSocket (/ws)          │
    │         │                    │
    │         ▼                    │
    │  PM2 Process Manager         │
    │  ├─ upright-backend          │
    │  ├─ mock-sensor-1            │
    │  └─ mock-sensor-2            │
    │         │                    │
    │         ▼                    │
    │  Google Gemini API           │
    │  (AI Insights)               │
    │                              │
    └──────────────────────────────┘
                  │
                  │ HTTPS/WSS
                  ▼
         🌍 Internet Users
         (Any Browser)


┌────────────────────────────────────────────────────────────────────┐
│                    Data Flow Comparison                            │
└────────────────────────────────────────────────────────────────────┘

HARDWARE MODE:
Arduino → Serial → Bridge → Backend → WebSocket → Swift App
  20Hz    USB     HTTP      WS        Local       macOS

WEB DEMO MODE:
Mock → HTTP → Backend → WebSocket → Browser
20Hz   POST    WS        Real-time   Any Device

PRODUCTION MODE:
Mock → Backend → Nginx → Internet → Browser
PM2    Docker   Proxy    HTTPS      Worldwide
```

## File Structure After Implementation

```
uprighthacks/
├── 📄 README.md                    ✅ Updated with web demo info
├── 📄 .gitignore                   ✅ Updated with logs/
├── 📄 QUICKSTART.md                ✨ NEW - 5-minute setup
├── 📄 DEPLOYMENT.md                ✨ NEW - DigitalOcean guide
├── 📄 IMPLEMENTATION.md            ✨ NEW - Complete summary
├── 📄 ecosystem.config.js          ✨ NEW - PM2 configuration
│
├── 🔧 Arduino/
│   └── Posture Calibration/
│       └── posture_calibration.ino
│
├── 🖥️ backend/
│   ├── server.js
│   ├── gemini.js
│   ├── windowManager.js
│   ├── featureExtraction.js
│   ├── serial-bridge.js
│   ├── mock-sensor.js              ✨ NEW - Hardware simulator
│   ├── test-demo.js                ✨ NEW - Connectivity test
│   ├── package.json                ✅ Updated with new scripts
│   └── Gemini-Integration-Key.env
│
└── 📱 frontend/
    ├── web/                        ✨ NEW - Browser demo
    │   ├── index.html              ✨ NEW - Web UI
    │   ├── app.js                  ✨ NEW - Three.js + WebSocket
    │   └── README.md               ✨ NEW - Web frontend guide
    │
    └── UpperTorso3D.swiftpm/       (Existing Swift app)
        └── ...
```

## Component Responsibilities

### Mock Sensor (`mock-sensor.js`)
- Simulates MMA7660 accelerometer
- Generates realistic 3-axis data
- Multiple posture scenarios
- Configurable sample rate
- Posts to backend via HTTP

### Web Frontend (`frontend/web/`)
- Three.js 3D visualization
- WebSocket real-time updates
- Responsive UI design
- Works on all devices
- No installation needed

### Backend (Unchanged)
- HTTP API endpoints
- WebSocket broadcasting
- Window management
- Feature extraction
- Gemini AI integration

### PM2 Ecosystem
- Process management
- Auto-restart
- Log rotation
- Memory limits
- Production-ready

## Quick Commands

### Start Everything (Development)
```bash
# Terminal 1: Backend
cd backend && npm start

# Terminal 2: Mock Sensor #1
cd backend && npm run mock:sensor1

# Terminal 3: Mock Sensor #2
cd backend && npm run mock:sensor2

# Browser
open frontend/web/index.html
```

### Start Everything (Production)
```bash
pm2 start ecosystem.config.js
pm2 logs
```

### Test Setup
```bash
cd backend
npm run test:demo
```

## Success Metrics

✅ **Zero Hardware Required** - Full demo works without Arduino
✅ **Browser Compatible** - Works on any modern browser
✅ **Deploy Ready** - Complete DigitalOcean guide included
✅ **Production Config** - PM2 ecosystem ready to go
✅ **5-Minute Setup** - Quick start guide for local testing
✅ **Realistic Data** - Multiple posture scenarios
✅ **Beautiful UI** - Professional web design
✅ **Real AI** - Actual Gemini insights
✅ **Documentation** - 5+ comprehensive guides

## What's Different?

### Before
- Required 2 Arduinos ($25 each)
- Required 2 sensors ($10 each)
- Swift app only (macOS required)
- Complex hardware setup
- Can't share demo easily
- Limited to local machine

### After
- ✨ **Web demo** works anywhere
- ✨ **$0 hardware cost** for demos
- ✨ **Any device** with browser
- ✨ **5-minute setup** locally
- ✨ **Share via URL** when deployed
- ✨ **Cloud-ready** for production

**Result: Your hackathon project is now accessible to everyone!** 🎉
