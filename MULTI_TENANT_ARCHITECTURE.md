# Multi-Tenant Architecture Guide

## Overview
This application uses a **row-level multi-tenancy** model where all tenant-specific data is isolated using a `userId` column. Every table that contains tenant-specific data includes a `userId` foreign key to the `users` table.

## Security Model

### Database-Level Isolation
All tenant-specific tables include:
- **userId column**: Foreign key to `users.id` with `CASCADE DELETE`
- **Indexes**: All userId columns are indexed for query performance
- **Composite unique constraints**: Parent tables have `UNIQUE(id, userId)` to prevent ID reuse across tenants

### Application-Level Enforcement (CRITICAL)

⚠️ **IMPORTANT**: The database schema alone does NOT fully prevent cross-tenant data access. Application code MUST enforce tenant isolation in ALL queries.

**Every database query MUST:**
1. Filter by the authenticated user's `userId`
2. Verify tenant ownership before updates/deletes
3. Never trust client-provided IDs without tenant verification

## Tables with Tenant Isolation

### Core Tables
- ✅ `users` - Foundation table (tenant identity)
- ✅ `sessions` - User sessions
- ✅ `user_settings` - User preferences

### Domain Tables
- ✅ `subscribers` - Email subscribers (userId + unique email per user)
- ✅ `email_templates` - Email templates (userId + unique name per user)
- ✅ `campaigns` - Email campaigns (userId)
- ✅ `lists` - Subscriber lists (userId + unique name per user)
- ✅ `blacklist` - Blocked emails/domains (userId)
- ✅ `rules` - Automation rules (userId)

### Join & Analytics Tables
- ✅ `campaign_subscribers` - Campaign-subscriber relationships (userId)
- ✅ `link_clicks` - Click tracking (userId)
- ✅ `campaign_analytics` - Campaign metrics (userId)

## Query Patterns

### ✅ CORRECT - Always filter by userId
```typescript
// Fetch user's campaigns
const campaigns = await db
  .select()
  .from(campaigns)
  .where(eq(campaigns.userId, authenticatedUserId));

// Fetch single campaign with ownership check
const campaign = await db
  .select()
  .from(campaigns)
  .where(
    and(
      eq(campaigns.id, campaignId),
      eq(campaigns.userId, authenticatedUserId)
    )
  )
  .limit(1);

// Update with ownership verification
await db
  .update(campaigns)
  .set({ name: 'Updated Name' })
  .where(
    and(
      eq(campaigns.id, campaignId),
      eq(campaigns.userId, authenticatedUserId)
    )
  );

// Delete with ownership verification
await db
  .delete(campaigns)
  .where(
    and(
      eq(campaigns.id, campaignId),
      eq(campaigns.userId, authenticatedUserId)
    )
  );
```

### ❌ WRONG - Missing userId filter (SECURITY VULNERABILITY)
```typescript
// DON'T DO THIS - No tenant isolation!
const campaign = await db
  .select()
  .from(campaigns)
  .where(eq(campaigns.id, campaignId)); // Missing userId check!

// DON'T DO THIS - Could update another user's data!
await db
  .update(campaigns)
  .set({ name: 'Updated' })
  .where(eq(campaigns.id, campaignId)); // Missing userId check!
```

## Join Query Patterns

### ✅ CORRECT - Filter all tables by same userId
```typescript
const campaignWithTemplate = await db
  .select()
  .from(campaigns)
  .leftJoin(
    emailTemplates,
    and(
      eq(campaigns.templateId, emailTemplates.id),
      eq(emailTemplates.userId, authenticatedUserId) // Ensure same tenant
    )
  )
  .where(
    and(
      eq(campaigns.id, campaignId),
      eq(campaigns.userId, authenticatedUserId)
    )
  );
```

### ❌ WRONG - Join without tenant verification
```typescript
// DON'T DO THIS - Could join cross-tenant data!
const campaignWithTemplate = await db
  .select()
  .from(campaigns)
  .leftJoin(
    emailTemplates,
    eq(campaigns.templateId, emailTemplates.id) // Missing userId check on join!
  )
  .where(eq(campaigns.id, campaignId)); // Missing userId filter!
```

## Authentication Middleware

Every protected API route MUST:
1. Verify session token validity
2. Extract userId from session
3. Pass userId to all database queries
4. Never trust userId from request body/query params

```typescript
// Example middleware
async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const session = await db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.token, token),
        gt(sessions.expiresAt, new Date())
      )
    )
    .limit(1);
  
  if (!session[0]) {
    return res.status(401).json({ error: 'Invalid session' });
  }
  
  // CRITICAL: Attach userId to request for all queries
  req.userId = session[0].userId;
  next();
}
```

## Data Import/Export

### Import
When importing data (subscribers, campaigns, etc.):
```typescript
// Always set userId to authenticated user
await db.insert(subscribers).values({
  userId: authenticatedUserId, // REQUIRED
  email: importedEmail,
  firstName: importedFirstName,
  // ...
});
```

### Export
When exporting data:
```typescript
// Always filter by userId
const data = await db
  .select()
  .from(subscribers)
  .where(eq(subscribers.userId, authenticatedUserId));
```

## GDPR Compliance

User deletion automatically cascades to all related data:
```typescript
// Delete user and ALL their data (cascade)
await db
  .delete(users)
  .where(eq(users.id, userId));

// This automatically deletes:
// - sessions, user_settings
// - subscribers, email_templates, campaigns
// - lists, blacklist, rules
// - campaign_subscribers, link_clicks, campaign_analytics
```

## Testing Multi-Tenant Isolation

### Unit Tests
```typescript
test('users cannot access other users data', async () => {
  const user1Id = 'user-1';
  const user2Id = 'user-2';
  
  // User 1 creates a campaign
  const campaign = await createCampaign({ userId: user1Id, name: 'Test' });
  
  // User 2 tries to fetch User 1's campaign
  const result = await db
    .select()
    .from(campaigns)
    .where(
      and(
        eq(campaigns.id, campaign.id),
        eq(campaigns.userId, user2Id) // Different user
      )
    );
  
  expect(result).toHaveLength(0); // Should find nothing
});
```

### Integration Tests
1. Create two test users
2. Create data for user A
3. Attempt to access user A's data as user B
4. Verify access is denied (empty results)

## Common Pitfalls

### 1. Trusting Client-Provided IDs
```typescript
// ❌ WRONG
app.delete('/api/campaigns/:id', async (req, res) => {
  await db.delete(campaigns).where(eq(campaigns.id, req.params.id));
});

// ✅ CORRECT
app.delete('/api/campaigns/:id', requireAuth, async (req, res) => {
  await db
    .delete(campaigns)
    .where(
      and(
        eq(campaigns.id, req.params.id),
        eq(campaigns.userId, req.userId) // From auth middleware
      )
    );
});
```

### 2. Forgetting userId in Joins
Always verify userId on BOTH sides of a join to prevent cross-tenant associations.

### 3. Batch Operations
When performing batch operations, always filter by userId:
```typescript
// ✅ CORRECT - Delete all user's campaigns
await db
  .delete(campaigns)
  .where(eq(campaigns.userId, authenticatedUserId));

// ❌ WRONG - Could delete other users' data
await db.delete(campaigns); // Missing where clause!
```

## Composite Unique Constraints

The following tables have composite unique constraints:

### subscribers
- `UNIQUE(userId, email)` - Each user can have subscriber with unique email
- `UNIQUE(id, userId)` - ID is unique within tenant scope

### email_templates
- `UNIQUE(userId, name)` - Template names must be unique per user
- `UNIQUE(id, userId)` - ID is unique within tenant scope

### campaigns
- `UNIQUE(id, userId)` - ID is unique within tenant scope

### lists
- `UNIQUE(userId, name)` - List names must be unique per user

## Performance Considerations

### Indexes
All userId columns are indexed for fast filtering:
- `sessions_user_id_idx`
- `user_settings_user_id_idx`
- `lists_user_id_idx`
- `blacklist_user_id_idx`
- `rules_user_id_idx`
- `subscribers_user_id_idx`
- `email_templates_user_id_idx`
- `campaigns_user_id_idx`
- `campaign_subscribers_user_id_idx`
- `link_clicks_user_id_idx`
- `campaign_analytics_user_id_idx`

### Query Optimization
- Always include userId in WHERE clauses (enables index usage)
- Use compound indexes for common filter combinations
- Consider materialized views for complex cross-table queries

## Migration Notes

All userId columns were added with NOT NULL constraints. When applying to existing data:
1. Tables were truncated to allow adding NOT NULL userId columns
2. Future migrations will preserve data by setting default userId before constraint
3. Always backup data before schema changes

## Summary

✅ **Database provides**: Structure, indexes, cascade deletes, unique constraints
⚠️ **Application MUST provide**: Query-level tenant filtering, authentication, authorization

This is the industry-standard approach used by:
- Stripe (API keys scope to accounts)
- GitHub (repo ownership)
- Slack (workspace isolation)
- Most B2B SaaS platforms

The key is **developer discipline** - every query MUST include userId filtering.
