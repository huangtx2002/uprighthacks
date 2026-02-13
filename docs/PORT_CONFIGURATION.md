# Upright Port Configuration

## Current Port Assignment

As documented in `/home/sean/projectsmanagement/ports_management.txt`:

```
Upright: frontend-5373, backend-ws 8003
```

## Port Summary

| Service | Port | Description |
|---------|------|-------------|
| Frontend Web Server | 5373 | Serves HTML/CSS/JS files for web interface |
| Backend WebSocket + API | 8003 | WebSocket server + HTTP REST API endpoints |

## Architecture

```
User Browser
    ↓ http://ip:5373
Frontend Static Server (PM2)
    ↓ ws://ip:8003
Backend Server (PM2)
    ↑ http://ip:8003/imu
Sensors / Mock Sensors
```

## Files Updated

### Backend Code
- ✅ `backend/server.js` - Main backend server (PORT default: 8003)
- ✅ `backend/mock-sensor.js` - Mock sensor simulator (default port: 8003)
- ✅ `backend/test-demo.js` - Demo test script (PORT: 8003)
- ✅ `backend/test-insights.js` - Insights test script (PORT: 8003)
- ✅ `backend/serial-bridge.js` - Serial bridge (default port: 8003)

### Frontend Code
- ✅ `frontend/web/app.js` - WebSocket URL: `ws://localhost:8003`
- ✅ `frontend/web/server.js` - NEW: Static file server (PORT: 5373)
- ✅ `frontend/UpperTorso3D.swiftpm/TelemetryWebSocket.swift` - WebSocket URL: `ws://localhost:8003`

### Configuration
- ✅ `ecosystem.config.js` - PM2 configuration with frontend (5373) and backend (8003)

### Documentation
- ✅ `README.md` - All port references updated
- ✅ `GET_STARTED.md` - Port references updated
- ✅ `DEPLOYMENT.md` - Port references updated
- ✅ `ARCHITECTURE.md` - Architecture diagrams updated
- ✅ `IMPLEMENTATION.md` - WebSocket URL updated
- ✅ `GLOWING_BACK_IMPLEMENTATION.md` - Serial bridge commands updated
- ✅ `frontend/web/README.md` - Port references updated

## How to Start

### Using PM2 (Recommended)

```bash
cd /home/sean/uprighthacks
pm2 start ecosystem.config.js
```

This starts:
1. **upright-frontend** - Static file server on port 5373
2. **upright-backend** - WebSocket + API server on port 8003
3. **mock-sensor-1** - Simulated upper back sensor
4. **mock-sensor-2** - Simulated lower back sensor

### Manual Start

**Terminal 1 - Backend:**
```bash
cd backend
PORT=8003 npm start
```

**Terminal 2 - Frontend:**
```bash
cd frontend/web
PORT=5373 node server.js
```

**Terminal 3 - Mock Sensor 1:**
```bash
cd backend
node mock-sensor.js --sensor 1 --port 8003
```

**Terminal 4 - Mock Sensor 2:**
```bash
cd backend
node mock-sensor.js --sensor 2 --port 8003
```

## Access Points

- **Web Interface**: http://159.89.112.149:5373 (or http://localhost:5373)
- **Backend API**: http://159.89.112.149:8003 (or http://localhost:8003)
- **WebSocket**: ws://159.89.112.149:8003 (or ws://localhost:8003)

## Testing

```bash
# Check backend is running
curl http://localhost:8003

# Check latest data
curl http://localhost:8003/latest1

# Check Gemini health
curl http://localhost:8003/gemini/health

# Test WebSocket (requires wscat: npm i -g wscat)
wscat -c ws://localhost:8003
```

## Production Deployment

For production with custom domain, update:

1. **Frontend WebSocket URL** in `frontend/web/app.js`:
   ```javascript
   const WS_URL = 'ws://yourdomain.com:8003';
   ```

2. **Swift App WebSocket URL** in `frontend/UpperTorso3D.swiftpm/TelemetryWebSocket.swift`:
   ```swift
   private let baseURL = "ws://yourdomain.com:8003"
   ```

## Firewall Configuration

Ensure these ports are open:
```bash
sudo ufw allow 5373/tcp  # Frontend
sudo ufw allow 8003/tcp  # Backend WebSocket + API
```

## Port Conflicts

If ports are already in use:

```bash
# Check what's using the ports
lsof -i :5373
lsof -i :8003

# Kill processes if needed
sudo kill -9 <PID>
```

---

**Last Updated**: 2026-02-12
**Configuration**: Upright frontend-5373, backend-ws 8003
