# Hypd Games - Self-Hosting Deployment Guide

## Quick Start (5 minutes)

### Prerequisites
- A VPS with Ubuntu 22.04+ (DigitalOcean, Linode, Vultr, AWS, etc.)
- Minimum specs: 1 CPU, 2GB RAM, 25GB storage
- A domain name (optional but recommended for HTTPS)

### Step 1: Connect to your server
```bash
ssh root@your-server-ip
```

### Step 2: Install Docker
```bash
# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Docker Compose
apt install docker-compose-plugin -y

# Verify installation
docker --version
docker compose version
```

### Step 3: Clone/Upload the project
```bash
# Create app directory
mkdir -p /opt/hypd-games
cd /opt/hypd-games

# Upload your project files (use scp, rsync, or git)
# Example with scp from your local machine:
# scp -r /path/to/hypd-games/* root@your-server-ip:/opt/hypd-games/
```

### Step 4: Configure environment
```bash
# Copy example env file
cp .env.example .env

# Edit with your values
nano .env
```

**Important:** Change these values in `.env`:
- `DOMAIN` - Your domain name
- `SITE_URL` - Full URL with https://
- `JWT_SECRET` - Generate with: `openssl rand -hex 32`
- `SSL_EMAIL` - Your email for SSL notifications

### Step 5: Deploy!

**Option A: Without SSL (HTTP only, for testing)**
```bash
docker compose up -d
```
Your app is now live at `http://your-server-ip`

**Option B: With SSL/HTTPS (Production)**
```bash
# Point your domain to your server IP first!
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```
Your app is now live at `https://your-domain.com`

---

## DigitalOcean Specific Instructions

### Create a Droplet
1. Go to [DigitalOcean](https://digitalocean.com)
2. Create → Droplets
3. Choose:
   - **Image:** Ubuntu 22.04
   - **Plan:** Basic, $6/mo (1GB RAM) or $12/mo (2GB RAM recommended)
   - **Datacenter:** Choose closest to your users
   - **Authentication:** SSH Key (recommended) or Password
4. Click "Create Droplet"

### Connect your domain
1. Go to Networking → Domains
2. Add your domain
3. Create an A record pointing to your Droplet IP
4. Wait 5-15 minutes for DNS propagation

### Using DigitalOcean Managed MongoDB (Optional)
If you want a managed database instead of self-hosted:

1. Go to Databases → Create Database Cluster
2. Choose MongoDB
3. Select plan ($15/mo minimum)
4. Update your `.env`:
```
MONGO_URL=mongodb+srv://doadmin:password@your-cluster.mongo.ondigitalocean.com/hypd_games?authSource=admin&replicaSet=your-cluster
```

---

## Management Commands

### View logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f mongodb
```

### Restart services
```bash
docker compose restart
```

### Update the application
```bash
# Pull latest code
git pull  # or upload new files

# Rebuild and restart
docker compose up -d --build
```

### Backup MongoDB data
```bash
# Create backup
docker exec hypd-mongodb mongodump --out /data/backup

# Copy backup to host
docker cp hypd-mongodb:/data/backup ./mongodb-backup-$(date +%Y%m%d)
```

### Restore MongoDB data
```bash
# Copy backup to container
docker cp ./mongodb-backup hypd-mongodb:/data/backup

# Restore
docker exec hypd-mongodb mongorestore /data/backup
```

---

## Troubleshooting

### App not loading
```bash
# Check if containers are running
docker compose ps

# Check logs for errors
docker compose logs --tail=100
```

### MongoDB connection issues
```bash
# Check if MongoDB is healthy
docker exec hypd-mongodb mongosh --eval "db.adminCommand('ping')"

# Check backend can reach MongoDB
docker compose logs backend | grep -i mongo
```

### SSL certificate not working
```bash
# Check acme-companion logs
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs acme-companion

# Verify DNS is pointing to your server
dig your-domain.com
```

### Out of memory
```bash
# Check memory usage
docker stats

# Add swap space
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

---

## Security Checklist

- [ ] Changed default JWT_SECRET
- [ ] Changed admin password from `admin123`
- [ ] Set up firewall (UFW)
- [ ] Enabled automatic security updates
- [ ] Set up SSL/HTTPS
- [ ] Configured backup strategy

### Basic firewall setup
```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

---

## Cost Comparison

| Provider | Minimum Spec | Monthly Cost |
|----------|-------------|--------------|
| DigitalOcean | 1GB RAM | $6 |
| DigitalOcean | 2GB RAM (recommended) | $12 |
| Linode | 2GB RAM | $12 |
| Vultr | 2GB RAM | $12 |
| AWS Lightsail | 2GB RAM | $10 |
| Hetzner | 2GB RAM | €4.50 (~$5) |

**Note:** These are self-managed. You handle updates, security, backups.

---

## Need Help?

- Check container logs: `docker compose logs -f`
- MongoDB shell: `docker exec -it hypd-mongodb mongosh`
- Backend shell: `docker exec -it hypd-backend bash`
- Frontend shell: `docker exec -it hypd-frontend sh`
