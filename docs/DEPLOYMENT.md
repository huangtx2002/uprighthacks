# 🚀 Deployment Guide - DigitalOcean

This guide walks you through deploying Upright to your DigitalOcean Droplet.

---

## 📋 Prerequisites

- DigitalOcean droplet already set up (Ubuntu 22.04 LTS recommended)
- SSH access to your droplet
- Domain name (optional, but recommended)
- Basic Linux command-line knowledge

---

## 📦 Step 1: Deploy Application

### Create application directory
```bash
mkdir -p /opt/upright
cd /opt/upright
```

### Clone or upload your code
**Option A: Using Git (if repo is public)**
```bash
git clone https://github.com/YOUR_USERNAME/uprighthacks.git .
```

**Option B: Upload via SCP (from your local machine)**
```bash
# Run this on your LOCAL machine
scp -r uprighthacks/* root@YOUR_DROPLET_IP:/opt/upright/
```

### Install backend dependencies
```bash
cd /opt/upright/backend
npm install --production
```

---

## ⚙️ Step 2: Configure Environment

Create `.env` file in backend directory:

```bash
nano /opt/upright/backend/Gemini-Integration-Key.env
```

Add:
```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash
PORT=8003
```

Save: `Ctrl+O`, `Enter`, `Ctrl+X`

---

## 🔓 Step 3: Open Firewall Ports

### Allow traffic on required ports
```bash
# Allow frontend port
sudo ufw allow 5373/tcp

# Allow backend WebSocket + API port
sudo ufw allow 8003/tcp

# Check firewall status
sudo ufw status
```

You should see output like:
```
Status: active

To                         Action      From
--                         ------      ----
5373/tcp                   ALLOW       Anywhere
8003/tcp                   ALLOW       Anywhere
```

**Note:** These ports are now accessible from the internet:
- **Port 5373** - Frontend web interface
- **Port 8003** - Backend API + WebSocket

---

## 🚀 Step 4: Start Services with PM2

### Start all services
```bash
nano /opt/upright/ecosystem.config.js
```

Add:
```javascript
module.exports = {
  apps: [
    {
      name: 'upright-backend',
      cwd: '/opt/upright/backend',
      script: 'server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 8003
      }
    },
    {
      name: 'mock-sensor-1',
      cwd: '/opt/upright/backend',
      script: 'mock-sensor.js',
      args: '--sensor 1 --scenario realistic --hz 20',
      autorestart: true,
      watch: false
    },
    {
      name: 'mock-sensor-2',
      cwd: '/opt/upright/backend',
      script: 'mock-sensor.js',
      args: '--sensor 2 --scenario realistic --hz 20',
      autorestart: true,
      watch: false
    }
  ]
};
```

Save and exit.

### Start all services with PM2
```bash
cd /opt/upright
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Follow the instructions to enable auto-start on boot
```

### Check status
```bash
pm2 status
pm2 logs upright-backend --lines 50
pm2 logs mock-sensor-1 --lines 20
```

---

## 🌐 Step 5: Configure Nginx (Optional - for Domain)

### Update web frontend WebSocket URL
```bash
nano /opt/upright/frontend/web/app.js
```

Change line 5 from:
```javascript
const WS_URL = 'ws://localhost:8003';
```

To:
```javascript
const WS_URL = 'ws://YOUR_DROPLET_IP:8003';  // Or ws://yourdomain.com:8003
```

Or for production with SSL:
```javascript
const WS_URL = 'wss://yourdomain.com/ws';
```

### Create Nginx config
```bash
nano /etc/nginx/sites-available/upright
```

Add:
```nginx
server {
    listen 80;
    server_name YOUR_DROPLET_IP;  # Or your domain name

    # Serve web frontend
    location / {
        root /opt/upright/frontend/web;
        index index.html;
        try_files $uri $uri/ =404;
    }

    # Proxy API requests to backend
    location /api/ {
        proxy_pass http://localhost:8003/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # WebSocket proxy
    location /ws {
        proxy_pass http://localhost:8003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;
    }
}
```

### Enable site and restart Nginx
```bash
ln -s /etc/nginx/sites-available/upright /etc/nginx/sites-enabled/
nginx -t  # Test configuration
systemctl restart nginx
```

---

## 🔒 Step 6: Add SSL (Optional but Recommended)

### Install Certbot
```bash
apt install -y certbot python3-certbot-nginx
```

### Get SSL certificate (requires domain name)
```bash
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Follow prompts. Certbot will automatically configure Nginx for HTTPS.

### Update WebSocket URL to use WSS
```bash
nano /opt/upright/frontend/web/app.js
```

Change to:
```javascript
const WS_URL = 'wss://yourdomain.com/ws';
```

---

## ✅ Step 7: Verify Deployment

### Check services are running
```bash
pm2 status
# Should show 3 apps: upright-backend, mock-sensor-1, mock-sensor-2
```

### Test backend API
```bash
curl http://localhost:8003/latest1
curl http://localhost:8003/latest2
curl http://localhost:8003/gemini/health
```

### Test from browser
Open your browser and navigate to:
```
http://YOUR_DROPLET_IP
```

Or with domain:
```
https://yourdomain.com
```

You should see:
- ✅ Connection status: "🟢 Connected"
- ✅ Real-time pitch values updating
- ✅ 3D torso model rotating
- ✅ Back glow changing color
- ✅ Posture status (GOOD/BAD)
- ✅ AI insights appearing every 15 seconds

---

## 🛠️ Management Commands

### View logs
```bash
pm2 logs upright-backend
pm2 logs mock-sensor-1
pm2 logs mock-sensor-2
```

### Restart services
```bash
pm2 restart all
# Or restart individual service
pm2 restart upright-backend
```

### Stop services
```bash
pm2 stop all
```

### Update code
```bash
cd /opt/upright
git pull  # If using git
pm2 restart all
```

### Monitor resources
```bash
pm2 monit
```

---

## 🎛️ Demo Scenarios

You can change the posture scenario by editing the PM2 config:

```bash
nano /opt/upright/ecosystem.config.js
```

Change `--scenario` to one of:
- `good` - Perfect posture throughout
- `bad` - Continuous slouching
- `mixed` - Alternates between good and bad
- `realistic` - Natural variation (default)
- `gradual` - Posture slowly deteriorates

Then restart:
```bash
pm2 restart mock-sensor-1 mock-sensor-2
```

---

## 📊 Monitoring

### Setup PM2 monitoring (optional)
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
```

### Check system resources
```bash
htop  # Install: apt install htop
df -h  # Disk usage
free -h  # Memory usage
```

---

## 🐛 Troubleshooting

### Backend not starting
```bash
pm2 logs upright-backend
# Check for missing dependencies or env variables
```

### WebSocket not connecting
- Check firewall: `ufw status`
- Check Nginx config: `nginx -t`
- Verify backend is running: `pm2 status`
- Check browser console for errors

### Mock sensors not posting data
```bash
pm2 logs mock-sensor-1
# Verify backend is running and accessible
curl http://localhost:8003/latest1
```

### High CPU/Memory usage
```bash
pm2 monit
# Consider reducing mock sensor frequency:
# Change --hz 20 to --hz 10
```

### SSL issues
```bash
certbot renew --dry-run  # Test renewal
systemctl status certbot.timer  # Check auto-renewal
```

---

## 🔄 Updating the Application

### Pull latest changes
```bash
cd /opt/upright
git pull origin main
```

### Update backend
```bash
cd backend
npm install
pm2 restart upright-backend
```

### Update frontend
```bash
# Web files are served directly by Nginx
# Just refresh browser to see changes
```

---

## 💰 Cost Estimate

**DigitalOcean Droplet:**
- Basic ($6/month): 1 GB RAM, 1 CPU, 25 GB SSD - Good for demo
- General Purpose ($12/month): 2 GB RAM, 1 CPU, 50 GB SSD - Better performance

**Total monthly cost:** $6-12

**Free alternatives:**
- Heroku Free Tier (with limitations)
- Railway.app Free Tier
- Render.com Free Tier

---

## 🎉 Success!

Your Upright demo is now live and accessible to anyone with a web browser!

**Share your demo:**
```
https://yourdomain.com
```

**Features available:**
- ✅ Real-time 3D posture visualization
- ✅ Live sensor data (simulated)
- ✅ AI-powered insights every 15 seconds
- ✅ Color-coded posture feedback
- ✅ No hardware required

---

## 📞 Need Help?

- Check logs: `pm2 logs`
- DigitalOcean Community: [https://www.digitalocean.com/community](https://www.digitalocean.com/community)
- PM2 Documentation: [https://pm2.keymetrics.io/](https://pm2.keymetrics.io/)
- Nginx Documentation: [https://nginx.org/en/docs/](https://nginx.org/en/docs/)

---

**Your demo is ready! 🚀**
