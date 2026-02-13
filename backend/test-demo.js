#!/usr/bin/env node

/**
 * Quick test script to verify Upright demo setup
 * Tests backend connectivity and simulates a quick demo
 */

const http = require('http');
const WebSocket = require('ws');

const HOST = process.env.HOST || 'localhost';
const PORT = process.env.PORT || 8003;

console.log(`
╔═══════════════════════════════════════════════╗
║     Upright Demo - Connectivity Test          ║
╚═══════════════════════════════════════════════╝
`);

let testsRun = 0;
let testsPassed = 0;

function pass(name) {
  console.log(`✅ ${name}`);
  testsPassed++;
  testsRun++;
}

function fail(name, error) {
  console.log(`❌ ${name}`);
  if (error) console.log(`   Error: ${error}`);
  testsRun++;
}

// Test 1: Backend HTTP server
function testHTTP() {
  return new Promise((resolve) => {
    const req = http.get(`http://${HOST}:${PORT}/`, (res) => {
      if (res.statusCode === 200) {
        pass('Backend HTTP server responding');
        resolve(true);
      } else {
        fail('Backend HTTP server', `Status ${res.statusCode}`);
        resolve(false);
      }
    });
    
    req.on('error', (err) => {
      fail('Backend HTTP server', err.message);
      resolve(false);
    });
    
    req.setTimeout(3000, () => {
      fail('Backend HTTP server', 'Connection timeout');
      req.destroy();
      resolve(false);
    });
  });
}

// Test 2: Gemini health check
function testGemini() {
  return new Promise((resolve) => {
    const req = http.get(`http://${HOST}:${PORT}/gemini/health`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.ok && json.hasKey) {
            pass('Gemini API configured');
            resolve(true);
          } else {
            fail('Gemini API', 'API key not configured');
            resolve(false);
          }
        } catch (err) {
          fail('Gemini API', 'Invalid response');
          resolve(false);
        }
      });
    });
    
    req.on('error', (err) => {
      fail('Gemini API', err.message);
      resolve(false);
    });
    
    req.setTimeout(3000, () => {
      fail('Gemini API', 'Connection timeout');
      req.destroy();
      resolve(false);
    });
  });
}

// Test 3: WebSocket connection
function testWebSocket() {
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(`ws://${HOST}:${PORT}`);
      
      const timeout = setTimeout(() => {
        fail('WebSocket connection', 'Connection timeout');
        ws.close();
        resolve(false);
      }, 5000);
      
      ws.on('open', () => {
        clearTimeout(timeout);
        pass('WebSocket connection');
        ws.close();
        resolve(true);
      });
      
      ws.on('error', (err) => {
        clearTimeout(timeout);
        fail('WebSocket connection', err.message);
        resolve(false);
      });
    } catch (err) {
      fail('WebSocket connection', err.message);
      resolve(false);
    }
  });
}

// Test 4: Post sample data
function testPostSample() {
  return new Promise((resolve) => {
    const sample = {
      pitch: 12.5,
      pitch_smooth: 12.3,
      roll: -2.1,
      ts: Date.now()
    };
    
    const payload = JSON.stringify(sample);
    
    const options = {
      hostname: HOST,
      port: PORT,
      path: '/imu',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };
    
    const req = http.request(options, (res) => {
      if (res.statusCode === 200) {
        pass('POST /imu endpoint');
        resolve(true);
      } else {
        fail('POST /imu endpoint', `Status ${res.statusCode}`);
        resolve(false);
      }
    });
    
    req.on('error', (err) => {
      fail('POST /imu endpoint', err.message);
      resolve(false);
    });
    
    req.setTimeout(3000, () => {
      fail('POST /imu endpoint', 'Connection timeout');
      req.destroy();
      resolve(false);
    });
    
    req.write(payload);
    req.end();
  });
}

// Test 5: Get latest data
function testGetLatest() {
  return new Promise((resolve) => {
    const req = http.get(`http://${HOST}:${PORT}/latest1`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.pitch !== undefined) {
            pass('GET /latest1 endpoint');
            resolve(true);
          } else {
            fail('GET /latest1 endpoint', 'Invalid data format');
            resolve(false);
          }
        } catch (err) {
          fail('GET /latest1 endpoint', 'Invalid JSON');
          resolve(false);
        }
      });
    });
    
    req.on('error', (err) => {
      fail('GET /latest1 endpoint', err.message);
      resolve(false);
    });
    
    req.setTimeout(3000, () => {
      fail('GET /latest1 endpoint', 'Connection timeout');
      req.destroy();
      resolve(false);
    });
  });
}

// Run all tests
async function runTests() {
  console.log('🔍 Running tests...\n');
  
  await testHTTP();
  await testGemini();
  await testWebSocket();
  await testPostSample();
  await testGetLatest();
  
  console.log(`
╔═══════════════════════════════════════════════╗
║               Test Results                    ║
╠═══════════════════════════════════════════════╣
║  Tests Run:    ${testsRun}                              ║
║  Tests Passed: ${testsPassed}                              ║
║  Tests Failed: ${testsRun - testsPassed}                              ║
╚═══════════════════════════════════════════════╝
`);

  if (testsPassed === testsRun) {
    console.log('🎉 All tests passed! Your demo is ready.\n');
    console.log('Next steps:');
    console.log('  1. Start mock sensors:');
    console.log('     node mock-sensor.js --sensor 1 --scenario realistic');
    console.log('     node mock-sensor.js --sensor 2 --scenario realistic');
    console.log('  2. Open web frontend:');
    console.log('     open frontend/web/index.html');
    console.log('');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Check the errors above.\n');
    console.log('Common issues:');
    console.log('  - Backend not running: npm start');
    console.log('  - Wrong port: Check PORT in .env');
    console.log('  - Gemini API key: Check Gemini-Integration-Key.env');
    console.log('');
    process.exit(1);
  }
}

// Run
runTests().catch(err => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
