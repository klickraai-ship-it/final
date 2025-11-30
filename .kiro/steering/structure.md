# Project Structure

## Quick Navigation

| Need to... | Go to |
|------------|-------|
| Add API endpoint | `server/routes.ts` |
| Add database table | `shared/schema.ts` |
| Add React page | `components/` + `App.tsx` |
| Add UI component | `components/ui/` |
| Add test | `test/*.test.ts` |
| Change email processing | `server/emailTrackingService.ts` |

## Directory Layout

```
/
├── client/                     # Frontend source
│   ├── src/
│   │   ├── hooks/             # use-mobile.tsx
│   │   └── lib/
│   │       ├── api.ts         # API client (use this!)
│   │       └── utils.ts       # cn() helper
│   └── index.html
│
├── server/                     # Backend source
│   ├── index.ts               # Express app setup
│   ├── routes.ts              # ALL API routes (~2000 lines)
│   ├── db.ts                  # Database connection
│   ├── tracking.ts            # Tracking endpoints
│   ├── tokenUtils.ts          # HMAC token utilities
│   ├── trackingTokens.ts      # Token generators
│   ├── emailService.ts        # Send emails
│   ├── emailTrackingService.ts # Process emails for tracking
│   ├── sesService.ts          # AWS SES client
│   ├── encryption.ts          # AES-256-GCM
│   ├── rateLimiter.ts         # Rate limiting
│   ├── sanitizer.ts           # HTML sanitization
│   ├── paymentService.ts      # Payment processing
│   └── seed.ts                # Database seeding
│
├── shared/                     # Shared between frontend/backend
│   ├── schema.ts              # Database schema (SINGLE SOURCE OF TRUTH)
│   └── types.ts               # Shared TypeScript types
│
├── components/                 # React components
│   ├── ui/                    # Reusable UI (Button, Card, Modal, etc.)
│   ├── admin/                 # Admin-only components
│   ├── Dashboard.tsx          # Main dashboard
│   ├── CampaignsList.tsx      # Campaign CRUD
│   ├── SubscribersList.tsx    # Subscriber CRUD
│   ├── TemplatesList.tsx      # Template CRUD
│   ├── RichTextEditor.tsx     # TipTap editor
│   ├── Layout.tsx             # App shell (Header + Sidebar)
│   └── ...
│
├── test/                       # Test files
│   ├── setup.ts               # Test environment
│   ├── property-test-config.ts # fast-check config
│   └── *.test.ts              # Test files
│
├── App.tsx                     # Root component + routing
├── index.tsx                   # React entry point
└── index.html                  # HTML entry
```

## Key Files Explained

### `shared/schema.ts` - Database Schema
```typescript
// Define table
export const campaigns = pgTable("campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  // ...
});

// Define Zod schema for validation
export const insertCampaignSchema = z.object({
  name: z.string().min(1),
  // ...
});

// Types are inferred
export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
```

### `server/routes.ts` - API Routes
```typescript
// All routes defined here
app.get('/api/campaigns', requireAuth, async (req, res) => {
  const results = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.userId, req.userId)); // ALWAYS filter by userId
  res.json(results);
});
```

### `client/src/lib/api.ts` - API Client
```typescript
// Use this for all API calls
import { api } from '@/client/src/lib/api';

const campaigns = await api.get('/api/campaigns');
await api.post('/api/campaigns', data);
await api.put('/api/campaigns/123', data);
await api.delete('/api/campaigns/123');
```

### `components/ui/` - UI Components
```typescript
// Available components
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Input, TextArea, Select } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton, CardSkeleton } from '@/components/ui/LoadingSkeleton';
```

## Architecture Patterns

### Multi-Tenant Isolation (CRITICAL)
```typescript
// EVERY database query MUST include userId filter
// WRONG - Security vulnerability!
await db.select().from(campaigns).where(eq(campaigns.id, id));

// CORRECT
await db.select().from(campaigns).where(
  and(
    eq(campaigns.id, id),
    eq(campaigns.userId, req.userId)  // REQUIRED
  )
);
```

### Authentication Flow
```
Login Request → Validate credentials → Create session in DB
                                              ↓
                                    Return JWT token
                                              ↓
Client stores: localStorage.setItem('token', token)
                                              ↓
All requests include: Authorization: Bearer ${token}
                                              ↓
requireAuth middleware → Validate token → Attach req.userId
```

### Email Processing Pipeline
```
Template with merge tags
        ↓
processEmailForTracking()
        ↓
1. Replace {{first_name}}, {{last_name}}, etc.
2. Inject {{unsubscribe_url}} with HMAC token
3. Inject {{web_version_url}} with HMAC token
4. Wrap all <a href="http..."> with click tracking
5. Inject tracking pixel before </body>
        ↓
Send via AWS SES
```

### Component Data Flow
```
User Action (click, submit)
        ↓
Event Handler (handleSubmit)
        ↓
API Call (api.post('/api/...'))
        ↓
Server validates (Zod schema)
        ↓
Database query (filtered by userId)
        ↓
Response to client
        ↓
Update state (setCampaigns([...]))
        ↓
Re-render UI
```

## Adding New Features

### New API Endpoint
1. Add route in `server/routes.ts`
2. Use `requireAuth` middleware
3. Validate with Zod schema
4. Filter queries by `req.userId`

### New Database Table
1. Define in `shared/schema.ts`
2. Add Zod schema
3. Export types
4. Run `npm run db:push`

### New React Page
1. Create component in `components/`
2. Add route in `App.tsx`
3. Wrap with `<Layout>` if authenticated

### New UI Component
1. Create in `components/ui/`
2. Follow existing patterns (variants, sizes)
3. Export from file

## Import Aliases

```typescript
// @ = project root
import { db } from "@/server/db";
import { campaigns } from "@/shared/schema";
import { api } from "@/client/src/lib/api";
import { Button } from "@/components/ui/Button";
```

## File Naming

| Type | Convention | Example |
|------|------------|---------|
| React component | PascalCase | `CampaignsList.tsx` |
| Server module | camelCase | `emailService.ts` |
| Test file | `*.test.ts` | `tokenUtils.test.ts` |
| UI component | PascalCase in `ui/` | `ui/Button.tsx` |
| Config | lowercase.dots | `vite.config.ts` |
