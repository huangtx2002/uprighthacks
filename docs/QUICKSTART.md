# Quick Start Guide - Web Demo

This is the **fastest way** to try Upright without any hardware!

## 🚀 5-Minute Setup

### Step 1: Install Dependencies
```bash
cd backend
npm install
```

### Step 2: Create API Key File
```bash
echo 'GEMINI_API_KEY=your_key_here' > backend/Gemini-Integration-Key.env
```

### Step 3: Start Backend
```bash
cd backend
npm start
```

### Step 4: Start Mock Sensors (2 terminals)

**Terminal 2:**
```bash
cd backend
node mock-sensor.js --sensor 1 --scenario realistic
```

**Terminal 3:**
```bash
cd backend
node mock-sensor.js --sensor 2 --scenario realistic
```

### Step 5: Open Web App

Open `frontend/web/index.html` in your browser, or:

```bash
cd frontend/web
python3 -m http.server 8000
# Visit: http://localhost:8000
```

## ✅ What You Should See

- 🟢 Connection Status: "Connected"
- 📊 Real-time pitch values updating
- 🎨 3D torso rotating with sensor data
- 🔴/🟢 Back glow changing color
- ✓/✗ Posture status (GOOD/BAD)
- 💡 AI insights every 15 seconds

## 🎮 Try Different Scenarios

Stop the mock sensors (Ctrl+C) and restart with different scenarios:

```bash
# Perfect posture
node mock-sensor.js --sensor 1 --scenario good

# Bad posture (slouching)
node mock-sensor.js --sensor 1 --scenario bad

# Alternating good/bad
node mock-sensor.js --sensor 1 --scenario mixed

# Gradually worsening
node mock-sensor.js --sensor 1 --scenario gradual
```

## 🌐 Deploy to Production

Ready to share with the world? See [DEPLOYMENT.md](DEPLOYMENT.md) for full deployment guide.

---

**That's it! No Arduino, no Swift, just works.** 🎉
