# Coding Conventions

## TypeScript

### Type Definitions
```typescript
// Prefer interfaces for object shapes
interface Campaign {
  id: string;
  name: string;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
}

// Use type for unions and complex types
type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';

// Infer types from schema when possible
type Campaign = typeof campaigns.$inferSelect;
type InsertCampaign = z.infer<typeof insertCampaignSchema>;
```

### Null Handling
```typescript
// Use optional chaining
const name = subscriber.firstName ?? '';

// Use nullish coalescing for defaults
const lists = campaign.lists ?? [];
```

## React Components

### Component Structure
```typescript
// 1. Imports (grouped: react, external, internal, types)
import React, { useState, useEffect } from 'react';
import { Plus, Search } from 'lucide-react';
import { api } from '@/client/src/lib/api';
import type { Campaign } from '@/shared/types';

// 2. Interface definitions
interface CampaignsListProps {
  initialFilter?: string;
}

// 3. Component definition
const CampaignsList: React.FC<CampaignsListProps> = ({ initialFilter }) => {
  // 4. State declarations
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  // 5. Effects
  useEffect(() => {
    fetchCampaigns();
  }, []);

  // 6. Event handlers
  const handleDelete = async (id: string) => { ... };

  // 7. Render helpers
  const renderCampaignCard = (campaign: Campaign) => { ... };

  // 8. Main render
  return ( ... );
};

export default CampaignsList;
```

### State Management
- Use `useState` for local component state
- Lift state up when shared between siblings
- No global state library (keep it simple)
- Fetch data in `useEffect` with cleanup

### Loading States
```typescript
// Always show loading state
if (loading) {
  return <TableSkeleton rows={5} />;
}

// Handle empty states
if (items.length === 0) {
  return <EmptyState icon={Mail} title="No campaigns" ... />;
}
```

### Error Handling
```typescript
// Use toast for user feedback
import { toast } from 'sonner';

try {
  await api.post('/api/campaigns', data);
  toast.success('Campaign created!', {
    description: 'Your campaign is ready to send'
  });
} catch (error) {
  console.error('Error:', error);
  toast.error('Failed to create campaign', {
    description: 'Please check your inputs and try again'
  });
}
```

## API Patterns

### Route Handlers
```typescript
// Always validate input with Zod
const parsed = insertCampaignSchema.safeParse(req.body);
if (!parsed.success) {
  return res.status(400).json({ message: parsed.error.message });
}

// Always filter by userId
const campaigns = await db
  .select()
  .from(campaigns)
  .where(eq(campaigns.userId, req.userId));

// Return consistent response shapes
return res.json({ success: true, data: campaign });
// or
return res.status(404).json({ message: 'Campaign not found' });
```

### Error Responses
```typescript
// Standard error format
{ message: string; code?: string; details?: any }

// HTTP status codes
// 200 - Success
// 201 - Created
// 400 - Bad Request (validation error)
// 401 - Unauthorized (no/invalid token)
// 403 - Forbidden (demo expired, no permission)
// 404 - Not Found
// 429 - Too Many Requests (rate limited)
// 500 - Internal Server Error
```

## Styling (Tailwind CSS)

### Color Palette
- Background: `gray-900` (page), `gray-800` (cards), `gray-700` (inputs)
- Text: `white` (primary), `gray-300` (secondary), `gray-400` (muted)
- Accent: `indigo-600` / `blue-600` (primary), `purple-600` (secondary)
- Status: `green-*` (success), `yellow-*` (warning), `red-*` (danger)

### Responsive Breakpoints
```typescript
// Mobile-first approach
className="text-sm sm:text-base lg:text-lg"
className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
className="hidden md:block" // Desktop only
className="block md:hidden" // Mobile only
```

### Touch Targets
```typescript
// Minimum 44x44px for touch targets
className="min-h-[44px] min-w-[44px]"
```

### Component Variants
```typescript
// Use consistent variant patterns
variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success'
size?: 'sm' | 'md' | 'lg'
```

## Database Queries

### Always Include userId
```typescript
// CORRECT
await db.select().from(campaigns).where(eq(campaigns.userId, userId));

// WRONG - security vulnerability!
await db.select().from(campaigns).where(eq(campaigns.id, id));
```

### Use Transactions for Multi-Step Operations
```typescript
await db.transaction(async (tx) => {
  await tx.insert(campaigns).values(campaignData);
  await tx.insert(campaignAnalytics).values(analyticsData);
});
```

### Pagination
```typescript
const page = parseInt(req.query.page as string) || 1;
const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
const offset = (page - 1) * limit;

const results = await db
  .select()
  .from(campaigns)
  .where(eq(campaigns.userId, userId))
  .limit(limit)
  .offset(offset);
```

## Testing

### Test File Naming
- Unit tests: `*.test.ts`
- Property tests: Include "Property" in describe block name

### Test Structure
```typescript
describe('tokenUtils', () => {
  describe('generateToken', () => {
    it('should generate valid base64url token', () => { ... });
    it('should include expiry timestamp', () => { ... });
  });

  describe('Property: token roundtrip', () => {
    it('should validate any generated token', () => {
      testProperty('roundtrip', arbitraries.tokenData(), (data) => {
        const token = generateToken([data.campaignId]);
        return validateToken(token) !== null;
      });
    });
  });
});
```

## Security Checklist

When writing new code:
- [ ] Input validated with Zod schema
- [ ] Queries filtered by userId
- [ ] HTML content sanitized
- [ ] Sensitive data encrypted
- [ ] Rate limiting on public endpoints
- [ ] No secrets in code or logs
- [ ] HMAC tokens for public URLs
