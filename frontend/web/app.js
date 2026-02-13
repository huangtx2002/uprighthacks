// Upright Web Frontend - Real-Time Posture Visualization
// Uses Three.js for 3D rendering and WebSocket for real-time data

// Configuration
const WS_URL = 'ws://159.89.112.149:8003'; // Server IP address
const SLOUCH_THRESHOLD = 15; // degrees

// State
let ws = null;
let upperPitch = 0;
let lowerPitch = 0;
let sampleCount = 0;
let latestInsight = null;

// Three.js Scene Setup
let scene, camera, renderer, torsoGroup, backGlow;

function initThreeJS() {
    const container = document.getElementById('three-container');
    container.innerHTML = ''; // Clear loading message
    
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x333333);
    
    // Camera
    camera = new THREE.PerspectiveCamera(
        50,
        container.clientWidth / container.clientHeight,
        0.1,
        1000
    );
    camera.position.set(0, 0.8, 2.5);
    camera.lookAt(0, 0.5, 0);
    
    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);
    
    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight1.position.set(5, 10, 5);
    scene.add(directionalLight1);
    
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight2.position.set(-5, 5, -5);
    scene.add(directionalLight2);
    
    // Create torso group (will rotate based on sensor data)
    torsoGroup = new THREE.Group();
    scene.add(torsoGroup);
    
    // Create simplified torso model
    createTorso();
    
    // Create back glow indicator
    createBackGlow();
    
    // Handle window resize
    window.addEventListener('resize', onWindowResize, false);
    
    // Start animation loop
    animate();
}

function createTorso() {
    const material = new THREE.MeshPhongMaterial({
        color: 0x999999,
        shininess: 30
    });
    
    // Head
    const headGeometry = new THREE.SphereGeometry(0.22, 32, 32);
    const head = new THREE.Mesh(headGeometry, material);
    head.position.set(0, 1.1, 0);
    head.scale.set(0.85, 1.0, 0.88);
    torsoGroup.add(head);
    
    // Neck
    const neckGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.2, 16);
    const neck = new THREE.Mesh(neckGeometry, material);
    neck.position.set(0, 0.78, 0);
    torsoGroup.add(neck);
    
    // Upper body (torso)
    const torsoGeometry = new THREE.BoxGeometry(0.6, 0.6, 0.3);
    const torso = new THREE.Mesh(torsoGeometry, material);
    torso.position.set(0, 0.4, 0);
    torsoGroup.add(torso);
    
    // Abdomen
    const abdomenGeometry = new THREE.BoxGeometry(0.5, 0.4, 0.25);
    const abdomen = new THREE.Mesh(abdomenGeometry, material);
    abdomen.position.set(0, 0.05, 0);
    torsoGroup.add(abdomen);
    
    // Arms (simple cylinders)
    for (let side of [-1, 1]) {
        const armGeometry = new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8);
        const arm = new THREE.Mesh(armGeometry, material);
        arm.position.set(side * 0.5, 0.3, 0);
        arm.rotation.z = side * 0.3;
        torsoGroup.add(arm);
    }
}

function createBackGlow() {
    // Create a glowing disc on the back
    const glowGeometry = new THREE.SphereGeometry(0.35, 32, 32);
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ff00, // Green by default
        transparent: true,
        opacity: 0.6
    });
    
    backGlow = new THREE.Mesh(glowGeometry, glowMaterial);
    backGlow.position.set(0, 0.4, -0.32);
    backGlow.scale.set(1.0, 1.4, 0.15); // Flatten to disc shape
    torsoGroup.add(backGlow);
}

function updateBackGlow(isGoodPosture) {
    if (!backGlow) return;
    
    const targetColor = isGoodPosture ? 0x00ff00 : 0xff0000; // Green or Red
    backGlow.material.color.setHex(targetColor);
}

function updateTorsoRotation() {
    if (!torsoGroup) return;
    
    // Convert pitch to radians and apply to model
    const pitchRad = (upperPitch * Math.PI) / 180;
    torsoGroup.rotation.x = pitchRad;
}

function animate() {
    requestAnimationFrame(animate);
    
    // Slight auto-rotation for demo effect
    if (torsoGroup) {
        torsoGroup.rotation.y += 0.002;
    }
    
    renderer.render(scene, camera);
}

function onWindowResize() {
    const container = document.getElementById('three-container');
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

// WebSocket Connection
function connectWebSocket() {
    console.log('Connecting to WebSocket:', WS_URL);
    
    ws = new WebSocket(WS_URL);
    
    ws.onopen = () => {
        console.log('✅ WebSocket connected');
        updateConnectionStatus(true);
    };
    
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleMessage(data);
        } catch (err) {
            console.error('Failed to parse message:', err);
        }
    };
    
    ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        updateConnectionStatus(false);
    };
    
    ws.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        updateConnectionStatus(false);
        
        // Attempt reconnection after 3 seconds
        setTimeout(connectWebSocket, 3000);
    };
}

function handleMessage(data) {
    // Handle samples
    if (data.kind === 'sample') {
        sampleCount++;
        
        if (data.source === 1) {
            upperPitch = data.pitch_smooth || data.pitch || 0;
            document.getElementById('upper-pitch').textContent = upperPitch.toFixed(1) + '°';
        } else if (data.source === 2) {
            lowerPitch = data.pitch_smooth || data.pitch || 0;
            document.getElementById('lower-pitch').textContent = lowerPitch.toFixed(1) + '°';
        }
        
        // Update metrics
        const angleDiff = Math.abs(upperPitch - lowerPitch);
        document.getElementById('pitch-diff').textContent = angleDiff.toFixed(1) + '°';
        document.getElementById('sample-count').textContent = sampleCount;
        
        // Update posture status
        const isGoodPosture = angleDiff <= SLOUCH_THRESHOLD;
        updatePostureStatus(isGoodPosture);
        
        // Update 3D model
        updateTorsoRotation();
        updateBackGlow(isGoodPosture);
    }
    
    // Handle insights
    if (data.type === 'insight_update') {
        latestInsight = data;
        updateInsightCard(data);
    }
}

function updateConnectionStatus(connected) {
    const statusEl = document.getElementById('connection-status');
    if (connected) {
        statusEl.textContent = '🟢 Connected';
        statusEl.className = 'connection-status connected';
    } else {
        statusEl.textContent = '🔴 Disconnected';
        statusEl.className = 'connection-status disconnected';
    }
}

function updatePostureStatus(isGood) {
    const statusEl = document.getElementById('status-value');
    if (isGood) {
        statusEl.textContent = 'GOOD ✓';
        statusEl.className = 'status-value good';
    } else {
        statusEl.textContent = 'BAD ✗';
        statusEl.className = 'status-value bad';
    }
}

function updateInsightCard(insight) {
    const cardEl = document.getElementById('insight-card');
    const iconEl = document.getElementById('insight-icon');
    const ratingEl = document.getElementById('insight-rating');
    const summaryEl = document.getElementById('insight-summary');
    const tipEl = document.getElementById('insight-tip');
    
    cardEl.style.display = 'block';
    
    // Set icon based on rating
    const icons = {
        good: '✅',
        fair: '⚠️',
        not_so_good: '⚠️',
        poor: '❌'
    };
    iconEl.textContent = icons[insight.rating] || '💡';
    
    // Set rating
    ratingEl.textContent = insight.rating.toUpperCase().replace(/_/g, ' ');
    
    // Set summary
    summaryEl.textContent = insight.summary || 'Analyzing your posture...';
    
    // Set tip
    tipEl.textContent = '💡 ' + (insight.tip || 'Keep monitoring your posture!');
}

// Request Gemini Analysis (On-Demand)
async function requestGeminiAnalysis() {
    const button = document.getElementById('analyze-button');
    const statusEl = document.getElementById('analyze-status');
    
    // Disable button during request
    button.disabled = true;
    button.textContent = '⏳ Analyzing...';
    statusEl.textContent = 'Calling Gemini API...';
    statusEl.style.color = '#fbbf24';
    
    try {
        // Extract base URL from WebSocket URL (ws://localhost:8003 -> http://localhost:8003)
        const baseUrl = WS_URL.replace('ws://', 'http://').replace('wss://', 'https://');
        
        // Call backend Gemini API endpoint
        const response = await fetch(`${baseUrl}/gemini/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                window: 300,  // Analyze last 300 samples
                source: 'both' // Both sensors
            })
        });
        
        const result = await response.json();
        
        if (result.ok) {
            // Display the analysis result
            displayGeminiAnalysis(result.result);
            statusEl.textContent = '✅ Analysis complete!';
            statusEl.style.color = '#4ade80';
            
            // Clear status after 3 seconds
            setTimeout(() => {
                statusEl.textContent = '';
            }, 3000);
        } else {
            throw new Error(result.error || 'Analysis failed');
        }
    } catch (error) {
        console.error('Gemini analysis error:', error);
        statusEl.textContent = '❌ Analysis failed: ' + error.message;
        statusEl.style.color = '#f87171';
        
        // Clear error after 5 seconds
        setTimeout(() => {
            statusEl.textContent = '';
        }, 5000);
    } finally {
        // Re-enable button
        button.disabled = false;
        button.textContent = '🤖 Analyze My Posture Now';
    }
}

// Display Gemini Analysis Result
function displayGeminiAnalysis(result) {
    const insightCard = document.getElementById('insight-card');
    const insightIcon = document.getElementById('insight-icon');
    const insightRating = document.getElementById('insight-rating');
    const insightSummary = document.getElementById('insight-summary');
    const insightTip = document.getElementById('insight-tip');
    
    insightCard.style.display = 'block';
    
    // Map overall rating to icon and text
    const ratingMap = {
        'good': { icon: '✅', text: 'Good Posture', color: '#4ade80' },
        'okay': { icon: '⚠️', text: 'Fair Posture', color: '#fbbf24' },
        'bad': { icon: '❌', text: 'Poor Posture', color: '#f87171' }
    };
    
    const rating = ratingMap[result.overall] || ratingMap['okay'];
    
    insightIcon.textContent = rating.icon;
    insightRating.textContent = rating.text;
    insightRating.style.color = rating.color;
    
    // Display key findings
    const findings = result.key_findings || [];
    insightSummary.innerHTML = findings.map(f => `• ${f}`).join('<br>');
    
    // Display recommendations
    const recommendations = result.recommendations || [];
    if (recommendations.length > 0) {
        insightTip.textContent = '💡 ' + recommendations[0];
    }
    
    // Display metrics if available
    if (result.metrics) {
        const metricsText = `
            <br><br>
            <strong>Analysis Details:</strong><br>
            • Samples analyzed: ${result.metrics.samples}<br>
            • Slouch threshold: ${result.metrics.slouch_threshold_deg}°<br>
            • Slouch percentage: ${result.metrics.slouch_percent}%<br>
            • Confidence: ${result.confidence || 'N/A'}
        `;
        insightSummary.innerHTML += metricsText;
    }
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Upright Web Frontend starting...');
    
    // Initialize Three.js
    initThreeJS();
    
    // Connect WebSocket
    connectWebSocket();
});
