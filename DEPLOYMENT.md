## Build & Push Docker Image

```bash
docker build \
    --platform linux/arm64 \
    --tag sbaglivi/irontrack:latest \
    --push \
    .
```

## Run as System Service (Auto-Start)

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
EnvironmentFile=/home/pi/irontrack/.env
ExecStart=docker compose up
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

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
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

```bash
# Pull latest image
docker compose pull

# Restart with new image
docker compose up -d
```

## Database Backup

Your data is in `/app/data/irontrack.db` inside the container, mounted at `./data/irontrack.db` on the host.

```bash
# Manual backup
cp data/irontrack.db data/irontrack.db.backup

# Automated daily backup (crontab)
crontab -e
# Add:
0 2 * * * cp /home/pi/irontrack/data/irontrack.db /home/pi/irontrack/data/irontrack.db.$(date +\%Y\%m\%d)
```

## Security Considerations

### 1. Set a Secret Key

The `SECRET_KEY` env var is used to sign JWTs. Set it in `.env` (already referenced in `compose.yaml`):

```bash
# Generate a secure key
openssl rand -base64 32
```

Add to `.env`:
```
SECRET_KEY=your-generated-key-here
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

## Troubleshooting

### Port already in use
```bash
sudo lsof -i :8000
sudo kill <PID>
```

### Container won't start
```bash
docker compose logs irontrack
```

### Frontend shows but API fails
- Check CORS settings in `backend/src/app.ts`
- Check browser console for errors
