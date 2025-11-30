# Tech Stack & Commands

## Quick Reference

### Start Development
```bash
npm run dev              # Start server on http://localhost:5000
```

### Database Operations
```bash
npm run db:push          # Push schema changes to database
npm run db:studio        # Open Drizzle Studio GUI
npm run db:seed          # Seed sample data
npm run db:reset         # Reset and reseed database
npm run db:generate      # Generate migration files
```

### Testing
```bash
npm test                 # Run all tests once
npm run test:watch       # Watch mode
npm run test:property    # Property-based tests only
```

### Production
```bash
npm run build            # Build frontend + backend
npm start                # Start production server
```

## Frontend Stack

| Package | Version | Usage |
|---------|---------|-------|
| react | 19 | UI framework |
| react-router-dom | 7 | Client routing |
| typescript | 5.8 | Type safety |
| vite | 6 | Build tool |
| tailwindcss | 4 | Styling |
| @tiptap/* | 3.10 | Rich text editor |
| recharts | 3 | Charts |
| lucide-react | - | Icons |
| sonner | - | Toast notifications |

## Backend Stack

| Package | Version | Usage |
|---------|---------|-------|
| express | 5 | Web framework |
| drizzle-orm | 0.44 | Database ORM |
| zod | 4 | Validation |
| @neondatabase/serverless | - | PostgreSQL |
| @aws-sdk/client-ses | - | Email delivery |
| bcryptjs | 3 | Password hashing |
| helmet | 8 | Security headers |
| sanitize-html | - | HTML sanitization |

## Environment Variables

### Required (App Won't Start Without)
```bash
DATABASE_URL=postgresql://user:pass@host:5432/db
ENCRYPTION_KEY=your-32-char-minimum-key
```

### Optional (Features Disabled Without)
```bash
# AI Assistant
GEMINI_API_KEY=AIzaSy...

# Email Sending (AWS SES)
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1

# Tracking Tokens (auto-generated if missing)
TRACKING_SECRET=64-char-hex-string

# Debug Mode
NODE_ENV=development
VITE_API_DEBUG=true
```

### Generate Keys
```bash
# Generate ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Generate TRACKING_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Configuration Files

| File | Purpose |
|------|---------|
| `tsconfig.json` | Frontend TypeScript |
| `tsconfig.server.json` | Backend TypeScript |
| `vite.config.ts` | Vite bundler |
| `drizzle.config.ts` | Database ORM |
| `vitest.config.ts` | Test runner |
| `tailwind.config.ts` | Tailwind CSS |
| `postcss.config.js` | PostCSS |

## Build Output

```
dist/                    # Frontend build (Vite)
dist/server/             # Backend build (tsc)
migrations/              # SQL migrations (Drizzle)
```

## Security Features

### Encryption (AES-256-GCM)
```typescript
import { encrypt, decrypt, encryptObject } from '@/server/encryption';

const encrypted = encrypt('sensitive-data');
const decrypted = decrypt(encrypted);
const encryptedObj = encryptObject({ apiKey: 'secret' });
```

### Rate Limiting
```typescript
import { publicEndpointLimiter, subscribeRateLimiter } from '@/server/rateLimiter';

// Apply to routes
app.post('/api/subscribe', subscribeRateLimiter, handler);
```

| Limiter | Window | Max Requests |
|---------|--------|--------------|
| `publicEndpointLimiter` | 15 min | 100 |
| `subscribeRateLimiter` | 1 hour | 5 |
| `unsubscribeRateLimiter` | 5 min | 10 |
| `strictPublicLimiter` | 1 min | 10 |

### HTML Sanitization
```typescript
import { sanitizeEmailHtml, sanitizeSubject } from '@/server/sanitizer';

const safeHtml = sanitizeEmailHtml(userInput);
const safeSubject = sanitizeSubject(userInput);
```

### HMAC Tokens
```typescript
import { generateToken, validateToken } from '@/server/tokenUtils';

const token = generateToken(['campaignId', 'subscriberId']);
const data = validateToken(token); // null if invalid/expired
```

## Database

### Connection
```typescript
import { db } from '@/server/db';
import { campaigns } from '@/shared/schema';
import { eq } from 'drizzle-orm';

const results = await db
  .select()
  .from(campaigns)
  .where(eq(campaigns.userId, userId));
```

### Schema Location
All tables defined in `shared/schema.ts`:
- users, sessions, userSettings
- campaigns, emailTemplates, subscribers
- lists, blacklist, rules
- campaignSubscribers, campaignAnalytics
- linkClicks, webVersionViews
- paymentProviders, paymentTransactions
- termsAndConditions, userTermsAcceptance
- notifications

## Deployment

### Docker
```bash
docker build -t deliver-ai .
docker run -p 5000:5000 --env-file .env deliver-ai
```

### Environment Modes
| NODE_ENV | Behavior |
|----------|----------|
| `development` | Hot reload, verbose logs, relaxed security |
| `production` | Optimized build, Helmet enabled, strict CSP |

## Troubleshooting

### Port Already in Use
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <pid> /F

# Linux/Mac
lsof -i :5000
kill -9 <pid>
```

### Database Connection Failed
1. Check `DATABASE_URL` format
2. Verify database is running
3. Check firewall/network access
4. Test with `npm run db:studio`

### Build Errors
```bash
rm -rf node_modules dist
npm install
npm run build
```
