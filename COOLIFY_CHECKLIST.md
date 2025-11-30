# Coolify Deployment Checklist

Quick checklist for deploying Deliver-AI to Coolify.

## Pre-Deployment

- [ ] Coolify instance accessible
- [ ] GitHub repo: https://github.com/klickraai-ship-it/del-ai
- [ ] Domain name ready (optional)

## Step 1: Database Setup

- [ ] Create PostgreSQL database (Neon or Coolify)
- [ ] Copy DATABASE_URL connection string
- [ ] Test connection: `psql $DATABASE_URL -c "SELECT 1;"`

## Step 2: Generate Keys

Run locally and save output:

```bash
# ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# TRACKING_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

- [ ] ENCRYPTION_KEY generated
- [ ] TRACKING_SECRET generated

## Step 3: Coolify Configuration

### Create Application
- [ ] Click **+ New** → **Application**
- [ ] Select **Public Repository**
- [ ] Repository: `https://github.com/klickraai-ship-it/del-ai`
- [ ] Branch: `main`
- [ ] Build Pack: **Dockerfile**
- [ ] Port: `5000`

### Environment Variables
- [ ] `DATABASE_URL` = `<your-connection-string>`
- [ ] `ENCRYPTION_KEY` = `<generated-key>`
- [ ] `TRACKING_SECRET` = `<generated-secret>`
- [ ] `NODE_ENV` = `production`
- [ ] `PORT` = `5000`

### Optional Variables
- [ ] `GEMINI_API_KEY` (for AI assistant)
- [ ] `AWS_ACCESS_KEY_ID` (for email)
- [ ] `AWS_SECRET_ACCESS_KEY` (for email)
- [ ] `AWS_REGION` = `us-east-1`

### Domain Setup
- [ ] Add domain in Coolify
- [ ] Configure DNS A record
- [ ] Wait for SSL certificate (5-10 min)

## Step 4: Deploy

- [ ] Click **Deploy** button
- [ ] Watch build logs
- [ ] Wait for "Deployment successful" (~5-10 min)

## Step 5: Initialize Database

In Coolify Terminal:
```bash
npx drizzle-kit push
```

- [ ] Database tables created
- [ ] No errors in output

## Step 6: Verify

- [ ] Health check: `curl https://your-domain.com/api/health`
- [ ] Open application in browser
- [ ] Sign up test account
- [ ] Verify demo mode timer appears

## Step 7: Create Super Admin

Option A - Terminal:
```bash
npx tsx server/createSuperAdmin.ts
```

Option B - Database:
```sql
UPDATE users SET is_super_admin = true WHERE email = 'your@email.com';
```

- [ ] Super admin created
- [ ] Can access `/admin` dashboard

## Post-Deployment

- [ ] Configure payment providers (Admin Dashboard)
- [ ] Add terms & conditions (Admin Dashboard)
- [ ] Test email sending (Settings → Email Integration)
- [ ] Set up monitoring/alerts
- [ ] Configure backups

## Troubleshooting

If build fails:
1. Check Coolify logs
2. Verify environment variables
3. Clear build cache and retry

If app won't start:
1. Check DATABASE_URL is correct
2. Verify all required env vars are set
3. Check application logs in Coolify

If database connection fails:
1. Test connection string locally
2. Ensure `?sslmode=require` in URL
3. Check database is running

## Success Criteria

- ✅ Application accessible via HTTPS
- ✅ Health check returns 200 OK
- ✅ Can create account and login
- ✅ Demo mode works (10-minute timer)
- ✅ Super admin can access admin dashboard
- ✅ No errors in logs

---

**Estimated Time**: 15-20 minutes  
**Difficulty**: Easy  
**Status**: Ready to deploy ✅
