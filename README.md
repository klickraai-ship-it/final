# Deliver-AI (Zero AI Mail)

Multi-tenant newsletter and bulk email marketing platform with AI assistant.

## Features

- 📧 Campaign Management - Create, schedule, and send email campaigns
- 📊 Email Tracking - Track opens, clicks, bounces, and unsubscribes
- 🤖 AI Assistant - Google Gemini powered email writing assistant
- 💳 Payment Integration - Razorpay/PayPal support
- ⏱️ Demo Mode - 10-minute trial with full access
- 📝 Rich Text Editor - TipTap WYSIWYG editor with merge tags
- 📈 Analytics Dashboard - Real-time campaign performance metrics
- 🔒 Multi-tenant - Strict user isolation and data security

## Tech Stack

**Frontend:**
- React 19
- TypeScript 5.8
- Vite 6
- Tailwind CSS 4
- TipTap 3.10
- Recharts 3

**Backend:**
- Express 5
- Drizzle ORM 0.44
- PostgreSQL (Neon)
- Zod 4 (validation)
- AWS SES (email delivery)

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL database
- AWS SES credentials (optional, for sending emails)

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Push database schema
npm run db:push

# Start development server
npm run dev
```

The app will be available at http://localhost:5000

### Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string
- `ENCRYPTION_KEY` - 32+ character encryption key

Optional:
- `GEMINI_API_KEY` - Google Gemini API key for AI features
- `AWS_ACCESS_KEY_ID` - AWS credentials for SES
- `AWS_SECRET_ACCESS_KEY` - AWS secret key
- `AWS_REGION` - AWS region (default: us-east-1)

Generate keys:
```bash
# Encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Tracking secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Development

```bash
# Start dev server with hot reload
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Build for production
npm run build

# Start production server
npm start
```

## Database

```bash
# Push schema changes
npm run db:push

# Open Drizzle Studio (database GUI)
npm run db:studio

# Seed sample data
npm run db:seed

# Reset database
npm run db:reset
```

## Deployment

### Docker

```bash
# Build image
docker build -t deliver-ai .

# Run container
docker run -d \
  --name deliver-ai \
  -p 5000:5000 \
  --env-file .env \
  deliver-ai
```

### Coolify

1. Push code to Git repository
2. In Coolify dashboard, add new application
3. Select "Dockerfile" as build pack
4. Configure domain and environment variables
5. Deploy

## Project Structure

```
/
├── client/              # Frontend source
│   └── src/
│       ├── hooks/       # React hooks
│       └── lib/         # Utilities (api.ts, utils.ts)
├── server/              # Backend source
│   ├── index.ts         # Express app
│   ├── routes.ts        # API routes
│   ├── db.ts            # Database connection
│   └── ...              # Services and utilities
├── shared/              # Shared code
│   ├── schema.ts        # Database schema (Drizzle)
│   └── types.ts         # TypeScript types
├── components/          # React components
│   ├── ui/              # Reusable UI components
│   └── ...              # Feature components
├── test/                # Test files
├── Dockerfile           # Docker configuration
└── package.json         # Dependencies
```

## API Endpoints

### Authentication
- `POST /api/register` - Register new user
- `POST /api/login` - Login
- `POST /api/logout` - Logout
- `GET /api/user` - Get current user

### Campaigns
- `GET /api/campaigns` - List campaigns
- `POST /api/campaigns` - Create campaign
- `PUT /api/campaigns/:id` - Update campaign
- `DELETE /api/campaigns/:id` - Delete campaign
- `POST /api/campaigns/:id/send` - Send campaign

### Subscribers
- `GET /api/subscribers` - List subscribers
- `POST /api/subscribers` - Add subscriber
- `PUT /api/subscribers/:id` - Update subscriber
- `DELETE /api/subscribers/:id` - Delete subscriber

### Tracking
- `GET /track/open/:token` - Track email open
- `GET /track/click/:token` - Track link click
- `GET /unsubscribe/:token` - Unsubscribe page
- `POST /api/unsubscribe/:token` - Process unsubscribe

## Security

- AES-256-GCM encryption for sensitive data
- HMAC tokens for tracking URLs
- HTML sanitization for user content
- Rate limiting on public endpoints
- Helmet.js security headers
- Multi-tenant data isolation

## License

Proprietary

## Support

For issues and questions, contact the development team.
