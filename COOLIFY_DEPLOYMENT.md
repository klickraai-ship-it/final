# Coolify Deployment Guide

Complete guide to deploy Deliver-AI to Coolify.

## Prerequisites

- Coolify instance running (self-hosted or cloud)
- GitHub repository: https://github.com/klickraai-ship-it/del-ai
- PostgreSQL database (Neon, Supabase, or Coolify-managed)
- Domain name (optional but recommended)

## Step 1: Prepare Database

### Option A: Use Neon (Recommended)
1. Go to https://neon.tech
2. Create new project: "deliver-ai-production"
3. Copy connection string (starts with `postgresql://`)
4. Keep it for Step 3

### Option B: Use Coolify PostgreSQL
1. In Coolify dashboard, go to **Databases**
2. Click **+ New Database** → **PostgreSQL**
3. Name: `deliver-ai-db`
4. Click **Create**
5. Copy the connection string from database details

## Step 2: Generate Security Keys

Run these commands locally to generate keys:

```bash
# Generate ENCRYPTION_KEY (32-byte base64)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Generate TRACKING_SECRET (32-byte hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Save these keys - you'll need them in Step 3.

## Step 3: Create Application in Coolify

### 3.1 Add New Resource
1. Login to Coolify dashboard
2. Click **+ New** → **Application**
3. Select **Public Repository**

### 3.2 Configure Repository
- **Repository URL**: `https://github.com/klickraai-ship-it/del-ai`
- **Branch**: `main`
- **Build Pack**: `Dockerfile`
- **Dockerfile Location**: `./Dockerfile` (default)

### 3.3 Basic Settings
- **Name**: `deliver-ai`
- **Description**: Multi-tenant newsletter platform
- **Port**: `5000`

### 3.4 Environment Variables

Click **Environment Variables** and add these:

#### Required Variables
```bash
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
ENCRYPTION_KEY=<your-generated-key-from-step-2>
TRACKING_SECRET=<your-generated-secret-from-step-2>
NODE_ENV=production
PORT=5000
```

#### Optional Variables (Add if needed)
```bash
# AI Assistant
GEMINI_API_KEY=<your-gemini-key>

# AWS SES (for system emails)
AWS_ACCESS_KEY_ID=<your-aws-key>
AWS_SECRET_ACCESS_KEY=<your-aws-secret>
AWS_REGION=us-east-1
```

### 3.5 Domain Configuration

1. Click **Domains** tab
2. Add your domain: `deliver-ai.yourdomain.com`
3. Coolify will auto-provision SSL certificate (Let's Encrypt)

**DNS Setup:**
- Add A record: `deliver-ai.yourdomain.com` → `<coolify-server-ip>`
- Wait 5-10 minutes for DNS propagation

## Step 4: Deploy

1. Click **Deploy** button
2. Watch build logs in real-time
3. Build takes ~5-10 minutes

**Build Process:**
```
1. Clone repository
2. Build frontend (Vite)
3. Install dependencies
4. Create Docker image
5. Start container
6. Health check
```

## Step 5: Initialize Database

After first deployment:

1. Click **Terminal** in Coolify
2. Run database migration:
```bash
npx drizzle-kit push
```

This creates all required tables.

## Step 6: Verify Deployment

### Check Health
```bash
curl https://deliver-ai.yourdomain.com/api/health
```

Expected response:
```json
{"status":"ok","uptime":123}
```

### Test Application
1. Open: `https://deliver-ai.yourdomain.com`
2. Click **Sign Up**
3. Create test account
4. Verify demo mode works (10-minute timer)

## Step 7: Create Super Admin

### Option A: Via Terminal
1. In Coolify, click **Terminal**
2. Run:
```bash
npx tsx server/createSuperAdmin.ts
```
3. Follow prompts to create admin user

### Option B: Via Database
1. Sign up normally
2. In database, run:
```sql
UPDATE users 
SET is_super_admin = true, role = 'admin' 
WHERE email = 'your-email@example.com';
```

## Troubleshooting

### Build Fails

**Error: "Cannot find module"**
```bash
# Solution: Clear build cache in Coolify
# Settings → Build → Clear Cache → Rebuild
```

**Error: "ENCRYPTION_KEY not set"**
```bash
# Solution: Check environment variables
# Ensure ENCRYPTION_KEY is set in Coolify dashboard
```

### Application Won't Start

**Check Logs:**
1. Coolify dashboard → **Logs** tab
2. Look for error messages

**Common Issues:**
- Database connection failed → Check DATABASE_URL
- Port already in use → Coolify handles this automatically
- Health check failing → Check `/api/health` endpoint

### Database Connection Issues

**Error: "Connection refused"**
```bash
# If using Coolify PostgreSQL:
# 1. Check database is running
# 2. Use internal Docker network URL
# Format: postgresql://user:pass@postgres-container:5432/db

# If using Neon:
# 1. Ensure ?sslmode=require is in URL
# 2. Check Neon dashboard for connection string
```

### SSL Certificate Issues

**Certificate not provisioning:**
1. Verify DNS is pointing to Coolify server
2. Check domain in Coolify → Domains tab
3. Wait 10-15 minutes for Let's Encrypt
4. Check Coolify logs for certificate errors

## Post-Deployment Configuration

### 1. Configure Email Sending

Users configure their own AWS SES:
1. Login as user
2. Go to **Settings** → **Email Integration**
3. Add AWS SES credentials
4. Verify email/domain in AWS SES

### 2. Configure Payment Providers

Super admin only:
1. Login as super admin
2. Go to **Admin Dashboard**
3. Click **Payment Providers**
4. Add Razorpay or PayPal credentials

### 3. Set Terms & Conditions

1. Admin Dashboard → **Terms Management**
2. Add terms & conditions
3. Users must accept before using platform

## Monitoring

### View Logs
```bash
# In Coolify dashboard
Logs → Real-time logs
```

### Check Metrics
- CPU usage
- Memory usage
- Request count
- Error rate

### Set Up Alerts
1. Coolify → **Notifications**
2. Add webhook or email
3. Configure alerts for:
   - Application down
   - High CPU/memory
   - Build failures

## Updating Application

### Deploy New Version
1. Push changes to GitHub
2. Coolify auto-deploys (if enabled)
3. Or click **Deploy** manually

### Rollback
1. Coolify → **Deployments**
2. Find previous deployment
3. Click **Redeploy**

## Scaling

### Vertical Scaling
1. Coolify → **Resources**
2. Increase CPU/Memory limits
3. Restart application

### Horizontal Scaling
1. Add load balancer in Coolify
2. Deploy multiple instances
3. Use Redis for session storage

## Backup Strategy

### Database Backups
```bash
# Automated daily backups
# Coolify → Database → Backups → Enable
```

### Manual Backup
```bash
# In Coolify terminal
pg_dump $DATABASE_URL > backup.sql
```

## Security Checklist

- [x] HTTPS enabled (Let's Encrypt)
- [x] Environment variables secured
- [x] Database uses SSL
- [x] ENCRYPTION_KEY set
- [x] TRACKING_SECRET set
- [ ] Configure firewall rules
- [ ] Enable Coolify authentication
- [ ] Regular security updates

## Cost Optimization

### Coolify Resources
- **Minimum**: 2 CPU, 4GB RAM
- **Recommended**: 4 CPU, 8GB RAM
- **High Traffic**: 8 CPU, 16GB RAM

### Database
- **Neon Free Tier**: 0.5GB storage, 3GB transfer
- **Neon Pro**: $19/month, 10GB storage
- **Coolify PostgreSQL**: Uses server resources

## Support

### Coolify Issues
- Docs: https://coolify.io/docs
- Discord: https://coolify.io/discord

### Application Issues
- Check logs in Coolify dashboard
- Review DEPLOYMENT.md for detailed troubleshooting
- Check GitHub issues

## Quick Reference

### Environment Variables
```bash
DATABASE_URL=postgresql://...     # Required
ENCRYPTION_KEY=<32+ chars>        # Required
TRACKING_SECRET=<64 char hex>     # Required
NODE_ENV=production               # Required
PORT=5000                         # Required
GEMINI_API_KEY=<key>             # Optional
AWS_ACCESS_KEY_ID=<key>          # Optional
AWS_SECRET_ACCESS_KEY=<secret>   # Optional
```

### Useful Commands
```bash
# Database migration
npx drizzle-kit push

# Create super admin
npx tsx server/createSuperAdmin.ts

# Seed sample data (dev only)
npx tsx server/seed.ts

# Check health
curl https://your-domain.com/api/health
```

### URLs
- **Application**: https://deliver-ai.yourdomain.com
- **Health Check**: https://deliver-ai.yourdomain.com/api/health
- **Admin Dashboard**: https://deliver-ai.yourdomain.com/admin

---

**Deployment Time**: ~10-15 minutes  
**Status**: Production Ready ✅
