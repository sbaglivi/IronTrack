## Run as System Service (Auto-Start)

## Build
docker build \
    --platform linux/amd64 \
    --tag sbaglivi/irontrack:latest \
    --push \
    .

Create a systemd service to run IronTrack on boot:

```bash
sudo nano /etc/systemd/system/irontrack.service
```

**Paste this:**
```ini
[Unit]
Description=IronTrack Workout Tracker
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/irontrack
Environment="PATH=/home/pi/irontrack/irontrack/venv/bin"
ExecStart=/home/pi/irontrack/irontrack/venv/bin/uvicorn irontrack.main:app --host 0.0.0.0 --port 8000 --workers 2
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Enable and start:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable irontrack
sudo systemctl start irontrack

# Check status
sudo systemctl status irontrack

# View logs
sudo journalctl -u irontrack -f
```

## Nginx Reverse Proxy (Optional - Recommended)

For better performance and to run on port 80 (no :8000 in URL):

### Install Nginx

```bash
sudo apt install nginx -y
```

### Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/irontrack
```

**Paste this:**
```nginx
server {
    listen 80;
    server_name _;

    # Frontend static files + API
    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support (if needed later)
    location /ws {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

**Enable and restart:**
```bash
sudo ln -s /etc/nginx/sites-available/irontrack /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

**Now access at:**
```
http://raspberrypi.local
# or
http://192.168.1.XXX
```

## Update/Redeploy

When you make changes:

```bash
# Pull latest code (if using git)
git pull

# Or transfer new files via SCP
scp -r /path/to/irontrack pi@raspberrypi.local:~/

# Run deployment script
./deploy.sh

# Restart service
sudo systemctl restart irontrack
```

## Database Backup

Your data is in `irontrack.db`. Back it up regularly:

```bash
# Manual backup
cp irontrack/irontrack.db irontrack/irontrack.db.backup

# Automated daily backup (crontab)
crontab -e
# Add:
0 2 * * * cp /home/pi/irontrack/irontrack/irontrack.db /home/pi/irontrack/irontrack.db.$(date +\%Y\%m\%d)
```

## Performance Tips for Raspberry Pi

### 1. Use Raspberry Pi 3B+ or newer
- Pi Zero/1/2 may be slow
- Pi 4 recommended for best performance

### 2. Use a good SD card
- Class 10 or UHS-I recommended
- Consider USB SSD boot for Pi 4

### 3. Limit workers
```bash
# For Pi 3/4 with 1GB+ RAM
--workers 2

# For Pi Zero/older
--workers 1
```

### 4. Monitor resources
```bash
# Install htop
sudo apt install htop -y
htop

# Check memory
free -h

# Check temperature
vcgencmd measure_temp
```

## Troubleshooting

### Port already in use
```bash
# Find process using port 8000
sudo lsof -i :8000
# Kill it
sudo kill <PID>
```

### Service won't start
```bash
# Check logs
sudo journalctl -u irontrack -n 50

# Test manually
source irontrack/venv/bin/activate
uvicorn irontrack.main:app --host 0.0.0.0 --port 8000
```

### Can't access from other devices
```bash
# Check firewall (if enabled)
sudo ufw status
sudo ufw allow 8000/tcp

# Check if server is listening
netstat -tuln | grep 8000
```

### Frontend shows but API fails
- Check CORS settings in `irontrack/main.py`
- Verify API_URL is correct in production build
- Check browser console for errors

## Security Considerations

### 1. Change Secret Key
Edit `irontrack/auth.py`:
```python
SECRET_KEY = "your-random-32-char-secret-here"
```

Generate a secure key:
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 2. Enable HTTPS (if exposing to internet)
- Use Let's Encrypt with Certbot
- Or use a reverse proxy like Cloudflare Tunnel

### 3. Firewall
```bash
sudo apt install ufw -y
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 4. Keep Updated
```bash
sudo apt update && sudo apt upgrade -y
```
