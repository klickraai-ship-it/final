# Deliver-AI

Multi-tenant newsletter and bulk email platform with superadmin-controlled payments, demo mode, and comprehensive email analytics.

## Features

- 🔐 Multi-tenant architecture with strict user isolation
- 💳 $5 one-time payment via Razorpay/PayPal
- ⏱️ 10-minute demo mode for trial users
- 📧 WYSIWYG HTML email template builder (TipTap)
- 📅 Campaign creation, scheduling, and management
- 📊 Email tracking (opens, clicks, bounces, unsubscribes)
- 🤖 AI assistant powered by Google Gemini
- 📱 Mobile-responsive design
- 🌍 GDPR compliance

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your values

# Push database schema
npm run db:push

# Start development server
npm run dev
```

Open http://localhost:5000

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Tailwind CSS 4, TipTap |
| Backend | Node.js, Express 5, TypeScript |
| Database | PostgreSQL (Neon), Drizzle ORM |
| Email | AWS SES |
| AI | Google Gemini |
| Deployment | Docker, Coolify |

## Commands

```bash
npm run dev          # Development server
npm run build        # Production build
npm start            # Production server
npm test             # Run tests

npm run db:push      # Push schema to database
npm run db:studio    # Open database GUI
npm run db:seed      # Seed sample data
```

## Environment Variables

### Required
```bash
DATABASE_URL=postgresql://user:pass@host:5432/db
ENCRYPTION_KEY=<32+ char key>
```

### Optional
```bash
TRACKING_SECRET=<64 char hex>
GEMINI_API_KEY=<your key>
AWS_ACCESS_KEY_ID=<your key>
AWS_SECRET_ACCESS_KEY=<your secret>
AWS_REGION=us-east-1
```

Generate keys:
```bash
# ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# TRACKING_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Deployment

### Docker
```bash
docker build -t deliver-ai .
docker run -p 5000:5000 --env-file .env.production deliver-ai
```

### Coolify
1. Connect your Git repository
2. Set environment variables in Coolify dashboard
3. Deploy

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions.

## Project Structure

```
├── server/          # Backend (Express, API routes)
├── components/      # React components
├── shared/          # Shared schema and types
├── client/          # Frontend utilities
├── test/            # Test files
└── .kiro/steering/  # Development guidelines
```

## Documentation

- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment guide
- [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md) - All env vars
- [DATABASE.md](DATABASE.md) - Database schema
- [SECURITY.md](SECURITY.md) - Security practices

## License

Private - All rights reserved
