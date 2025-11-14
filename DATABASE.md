
# Database Documentation

## Overview

This project uses **PostgreSQL** with **Drizzle ORM** for type-safe database operations. The database is hosted on **Neon** (serverless PostgreSQL) and uses WebSocket-based connections for optimal performance.

## Connection

- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Driver**: `@neondatabase/serverless` with connection pooling
- **Configuration**: `drizzle.config.ts`
- **Schema**: `shared/schema.ts`
- **Database Client**: `server/db.ts`

### Environment Variables

```bash
DATABASE_URL=postgresql://[user]:[password]@[host]/[database]
```

## Schema Architecture

### Multi-Tenant Design

All data is **tenant-isolated** using a `userId` field. Every table (except foundation tables like `users`) includes:
- `userId`: References the owning user
- Composite foreign keys for cross-table relationships
- Query-level filtering by authenticated user's session

### Security Principles

1. **Session-based userId**: All tenant-scoped data uses `userId` from session, never from client
2. **Strict Zod schemas**: `.strict()` prevents userId injection via API
3. **Composite FKs**: Enforce same-tenant relationships at database level
4. **CASCADE deletes**: User deletion removes all associated data

## Tables

### Foundation Tables

#### `users`
User accounts and authentication.

| Column | Type | Description |
|--------|------|-------------|
| id | varchar (PK) | UUID primary key |
| email | text (unique) | User email address |
| passwordHash | text | Bcrypt hashed password |
| name | text | User full name |
| companyName | text | Optional company name |
| role | text | 'user' or 'admin' |
| isVerified | boolean | Email verification status |
| twoFactorEnabled | boolean | 2FA enabled flag |
| twoFactorSecret | text | 2FA secret (TOTP) |
| createdAt | timestamp | Account creation time |
| updatedAt | timestamp | Last update time |

#### `sessions`
Active user sessions with bearer tokens.

| Column | Type | Description |
|--------|------|-------------|
| id | varchar (PK) | UUID primary key |
| userId | varchar (FK) | References users.id |
| token | text (unique) | Bearer auth token |
| expiresAt | timestamp | Session expiration (30 days) |
| createdAt | timestamp | Session start time |

**Indexes**: `userId`, `token`

#### `userSettings`
Per-user application preferences.

| Column | Type | Description |
|--------|------|-------------|
| id | varchar (PK) | UUID primary key |
| userId | varchar (FK, unique) | References users.id |
| timezone | text | User timezone (default: UTC) |
| language | text | UI language (default: en_US) |
| theme | text | 'light' or 'dark' |
| defaultUrlParams | text | Default tracking params |
| testEmailPrefix | text | Prefix for test emails |
| rowsPerPage | integer | Pagination size (default: 200) |
| updatedAt | timestamp | Last update time |

#### `settings`
Global application settings (key-value store).

| Column | Type | Description |
|--------|------|-------------|
| id | varchar (PK) | UUID primary key |
| key | text (unique) | Setting identifier |
| value | jsonb | Setting value (any JSON) |
| updatedAt | timestamp | Last update time |

#### `emailProviderIntegrations`
Per-user email provider credentials (AWS SES only).

| Column | Type | Description |
|--------|------|-------------|
| id | varchar (PK) | UUID primary key |
| userId | varchar (FK, unique) | References users.id |
| provider | text | Always 'ses' |
| isActive | boolean | Provider enabled flag |
| config | jsonb | ⚠️ Provider credentials (PLAINTEXT) |
| createdAt | timestamp | Integration creation time |
| updatedAt | timestamp | Last update time |

**⚠️ SECURITY WARNING**: Credentials stored in **PLAINTEXT**. In production:
- Implement field-level encryption (AES-256-GCM)
- Use secure key management (KMS, Vault)
- Consider pgcrypto extension

### Domain Tables (Tenant-Scoped)

#### `lists`
Subscriber lists/segments.

| Column | Type | Description |
|--------|------|-------------|
| id | varchar (PK) | UUID primary key |
| userId | varchar (FK) | References users.id |
| name | text | List name (unique per user) |
| description | text | Optional description |
| subscriberCount | integer | Cached subscriber count |
| createdAt | timestamp | List creation time |
| updatedAt | timestamp | Last update time |

**Constraints**: Unique `(userId, name)`

#### `subscribers`
Email contacts with metadata.

| Column | Type | Description |
|--------|------|-------------|
| id | varchar (PK) | UUID primary key |
| userId | varchar (FK) | References users.id |
| email | text | Subscriber email (unique per user) |
| firstName | text | Optional first name |
| lastName | text | Optional last name |
| status | text | 'active', 'unsubscribed', 'bounced', 'complained' |
| lists | text[] | Array of list IDs |
| metadata | jsonb | Custom fields (JSON) |
| consentGiven | boolean | GDPR consent flag |
| consentTimestamp | timestamp | When consent was given |
| gdprDataExportedAt | timestamp | Last data export time |
| confirmed | boolean | Email confirmation status |
| confirmationToken | varchar (unique) | Double opt-in token |
| confirmationSentAt | timestamp | When confirmation sent |
| confirmedAt | timestamp | When confirmed |
| createdAt | timestamp | Subscriber creation time |
| updatedAt | timestamp | Last update time |

**Constraints**: Unique `(userId, email)`, `(id, userId)`

#### `blacklist`
Blocked emails/domains.

| Column | Type | Description |
|--------|------|-------------|
| id | varchar (PK) | UUID primary key |
| userId | varchar (FK) | References users.id |
| email | text | Blocked email (optional) |
| domain | text | Blocked domain (optional) |
| reason | text | 'hard_bounce', 'complaint', 'manual', 'spam' |
| blacklistedAt | timestamp | When blacklisted |

**Constraint**: At least one of `email` or `domain` must be set

#### `rules`
Automation rules for subscriber actions.

| Column | Type | Description |
|--------|------|-------------|
| id | varchar (PK) | UUID primary key |
| userId | varchar (FK) | References users.id |
| name | text | Rule name |
| triggerType | text | 'subscriber_created', 'email_opened', 'link_clicked', 'subscribed_to_list' |
| triggerConditions | jsonb | Trigger conditions (JSON) |
| actionType | text | 'add_to_list', 'remove_from_list', 'send_email', 'update_field' |
| actionData | jsonb | Action parameters (JSON) |
| isActive | boolean | Rule enabled flag |
| createdAt | timestamp | Rule creation time |
| updatedAt | timestamp | Last update time |

#### `emailTemplates`
Reusable email templates.

| Column | Type | Description |
|--------|------|-------------|
| id | varchar (PK) | UUID primary key |
| userId | varchar (FK) | References users.id |
| name | text | Template name (unique per user) |
| subject | text | Email subject line |
| htmlContent | text | HTML email body |
| textContent | text | Plain text version |
| thumbnailUrl | text | Preview thumbnail URL |
| createdAt | timestamp | Template creation time |
| updatedAt | timestamp | Last update time |

**Constraints**: Unique `(userId, name)`, `(id, userId)`

#### `campaigns`
Email sending campaigns.

| Column | Type | Description |
|--------|------|-------------|
| id | varchar (PK) | UUID primary key |
| userId | varchar (FK) | References users.id |
| name | text | Campaign name |
| subject | text | Email subject |
| templateId | varchar (FK) | References emailTemplates.id (nullable) |
| status | text | 'draft', 'scheduled', 'sending', 'sent', 'paused', 'failed' |
| fromName | text | Sender name |
| fromEmail | text | Sender email |
| replyTo | text | Reply-to address |
| lists | text[] | Array of list IDs |
| scheduledAt | timestamp | When to send |
| sentAt | timestamp | When sent |
| createdAt | timestamp | Campaign creation time |
| updatedAt | timestamp | Last update time |

**Constraints**: 
- Unique `(id, userId)`
- Composite FK to `emailTemplates(id, userId)` with SET NULL on delete

### Analytics & Join Tables

#### `campaignSubscribers`
Many-to-many: campaigns ↔ subscribers.

| Column | Type | Description |
|--------|------|-------------|
| id | varchar (PK) | UUID primary key |
| userId | varchar (FK) | References users.id |
| campaignId | varchar (FK) | References campaigns.id |
| subscriberId | varchar (FK) | References subscribers.id |
| status | text | 'pending', 'sent', 'delivered', 'bounced', 'failed' |
| sentAt | timestamp | When email sent |
| openedAt | timestamp | First open time |
| clickedAt | timestamp | First click time |
| bouncedAt | timestamp | Bounce time |
| complainedAt | timestamp | Complaint time |
| createdAt | timestamp | Record creation time |

**Composite FKs**:
- `(campaignId, userId)` → `campaigns(id, userId)`
- `(subscriberId, userId)` → `subscribers(id, userId)`

**Indexes**: `userId`, `campaignId`, `subscriberId`

#### `linkClicks`
Individual link click tracking.

| Column | Type | Description |
|--------|------|-------------|
| id | varchar (PK) | UUID primary key |
| userId | varchar (FK) | References users.id |
| campaignId | varchar (FK) | References campaigns.id |
| subscriberId | varchar (FK) | References subscribers.id |
| url | text | Clicked URL |
| clickedAt | timestamp | Click timestamp |

**Composite FKs**: Same as `campaignSubscribers`

#### `webVersionViews`
Email web version views.

| Column | Type | Description |
|--------|------|-------------|
| id | varchar (PK) | UUID primary key |
| userId | varchar (FK) | References users.id |
| campaignId | varchar (FK) | References campaigns.id |
| subscriberId | varchar (FK) | References subscribers.id |
| viewedAt | timestamp | View timestamp |
| ipAddress | text | Viewer IP |
| userAgent | text | Browser user agent |

**Composite FKs**: Same as `campaignSubscribers`

#### `campaignAnalytics`
Aggregated campaign metrics.

| Column | Type | Description |
|--------|------|-------------|
| id | varchar (PK) | UUID primary key |
| userId | varchar (FK) | References users.id |
| campaignId | varchar (FK, unique) | References campaigns.id |
| totalSubscribers | integer | Total recipients |
| sent | integer | Emails sent |
| delivered | integer | Successfully delivered |
| opened | integer | Unique opens |
| clicked | integer | Unique clicks |
| bounced | integer | Bounce count |
| complained | integer | Complaint count |
| unsubscribed | integer | Unsubscribe count |
| failed | integer | Failed sends |
| updatedAt | timestamp | Last metrics update |

**Composite FK**: `(campaignId, userId)` → `campaigns(id, userId)`

#### `notifications`
User notifications (in-app).

| Column | Type | Description |
|--------|------|-------------|
| id | text (PK) | UUID primary key |
| userId | text (FK) | References users.id |
| type | text | 'campaign_sent', 'bounce', 'complaint', 'info' |
| message | text | Notification message |
| read | boolean | Read status (default: false) |
| createdAt | timestamp | Notification time |

## Migrations

### Running Migrations

```bash
# Generate migration from schema changes
npm run db:generate

# Apply migrations to database
npm run db:migrate

# Push schema directly (development only)
npm run db:push
```

### Migration Files

- **Location**: `migrations/`
- **Format**: SQL files with metadata
- **Tool**: `drizzle-kit`

### Current Migrations

- `0000_yummy_squadron_supreme.sql`: Initial schema (16 tables)

## Data Sanitization

The project includes automatic sanitization for email templates to prevent XSS attacks:

```typescript
// Runs on server startup
runMigrations() → sanitizeExistingTemplates()
```

See `server/sanitizer.ts` for implementation details.

## Query Patterns

### Authentication Required

All tenant-scoped queries MUST:

1. Use `requireAuth` middleware
2. Filter by `req.userId` from session
3. Never trust `userId` from request body

```typescript
// ✅ CORRECT
app.get('/api/subscribers', requireAuth, async (req, res) => {
  const subscribers = await db
    .select()
    .from(schema.subscribers)
    .where(eq(schema.subscribers.userId, req.userId!));
  
  res.json(subscribers);
});

// ❌ WRONG - Missing userId filter
app.get('/api/subscribers', async (req, res) => {
  const subscribers = await db.select().from(schema.subscribers);
  res.json(subscribers); // Returns ALL users' data!
});
```

### Creating Records

```typescript
// ✅ CORRECT - userId from session
app.post('/api/subscribers', requireAuth, async (req, res) => {
  const validated = insertSubscriberSchema.parse(req.body); // .strict() blocks userId
  
  const [subscriber] = await db
    .insert(schema.subscribers)
    .values({ ...validated, userId: req.userId! })
    .returning();
  
  res.json(subscriber);
});
```

### Updating Records

```typescript
// ✅ CORRECT - Filter by both id AND userId
app.patch('/api/subscribers/:id', requireAuth, async (req, res) => {
  const sanitized = { ...req.body };
  delete sanitized.userId; // Strip userId from payload
  delete sanitized.id;
  delete sanitized.createdAt;
  delete sanitized.updatedAt;
  
  const [updated] = await db
    .update(schema.subscribers)
    .set(sanitized)
    .where(
      and(
        eq(schema.subscribers.id, req.params.id),
        eq(schema.subscribers.userId, req.userId!)
      )
    )
    .returning();
  
  if (!updated) return res.status(404).json({ message: 'Not found' });
  res.json(updated);
});
```

### Deleting Records

```typescript
// ✅ CORRECT - Filter by both id AND userId
app.delete('/api/subscribers/:id', requireAuth, async (req, res) => {
  const result = await db
    .delete(schema.subscribers)
    .where(
      and(
        eq(schema.subscribers.id, req.params.id),
        eq(schema.subscribers.userId, req.userId!)
      )
    );
  
  res.json({ success: true });
});
```

## Security Checklist

- [x] **Bcrypt password hashing** (cost factor 10)
- [x] **Session tokens** (30-day expiration)
- [x] **requireAuth middleware** on all protected routes
- [x] **Zod .strict() schemas** block userId injection
- [x] **userId from session only** (never from client)
- [x] **Composite foreign keys** enforce tenant isolation
- [x] **CASCADE deletes** for data cleanup
- [x] **XSS sanitization** for email templates
- [ ] **Field-level encryption** for provider credentials (TODO)

## Performance Considerations

### Indexes

All tenant-scoped tables have indexes on:
- `userId` (single-column index)
- Composite unique constraints where applicable

### Connection Pooling

Neon serverless driver automatically manages connection pooling via WebSocket connections.

### Query Optimization

- Use `.limit()` for large result sets
- Leverage composite indexes for multi-column filters
- Cache aggregated metrics in `campaignAnalytics`

## GDPR Compliance

### Data Export

Subscribers can request data export:
- `gdprDataExportedAt` timestamp tracks last export
- Export includes all subscriber data and campaign interactions

### Right to Erasure

User deletion cascades to:
- All subscribers
- All campaigns
- All templates
- All analytics data
- All sessions

### Consent Tracking

- `consentGiven` boolean flag
- `consentTimestamp` for audit trail
- Required before adding to campaigns

## Backup & Recovery

### Automated Backups

Neon provides automatic backups. See Neon dashboard for:
- Point-in-time recovery
- Snapshot management
- Backup retention policies

### Manual Export

```bash
# Export schema
npm run db:generate

# Export data (via Neon dashboard or pg_dump)
```

## Troubleshooting

### Common Issues

**Issue**: "DATABASE_URL must be set"
- **Solution**: Add `DATABASE_URL` to Replit Secrets

**Issue**: Migration conflicts
- **Solution**: Drop database and re-run migrations (dev only)

**Issue**: 401 Unauthorized on API calls
- **Solution**: Clear localStorage token and re-login

**Issue**: Slow queries
- **Solution**: Check indexes with `EXPLAIN ANALYZE`

## References

- [Drizzle ORM Documentation](https://orm.drizzle.team)
- [Neon Documentation](https://neon.tech/docs)
- [Multi-Tenant Architecture Guide](./MULTI_TENANT_ARCHITECTURE.md)
- [Security Guidelines](./SECURITY.md)
