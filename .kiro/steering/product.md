# Product Overview

Deliver-AI is a multi-tenant newsletter and bulk email platform with superadmin-controlled payments and comprehensive email analytics.

## Core Features

| Feature | Description |
|---------|-------------|
| Multi-tenant SaaS | Strict user isolation via userId on all tables |
| Payment System | One-time $5 via Razorpay/PayPal (superadmin configured) |
| Demo Mode | 10-minute trial with full access |
| Email Editor | TipTap WYSIWYG with merge tags |
| Campaigns | Create, schedule, send, track |
| Tracking | Opens, clicks, bounces, complaints, unsubscribes |
| Subscribers | Lists, import/export, GDPR compliance |
| Email Delivery | AWS SES integration |
| AI Assistant | Google Gemini powered |
| Analytics | Real-time dashboard with charts |

## User Roles & Permissions

### Regular User
- Create/edit/delete own campaigns
- Manage own subscribers and lists
- Create/edit email templates
- View own analytics
- Configure AWS SES credentials
- Access AI assistant

### Super Admin (`isSuperAdmin: true`)
- All regular user capabilities
- Manage payment providers (Razorpay/PayPal)
- View all users and transactions
- Manage terms & conditions
- Access admin dashboard at `/admin`

### Demo User (`paymentStatus: 'demo'`)
- Full access for 10 minutes
- Timer displayed in header
- Redirected to payment after expiry
- `DEMO_EXPIRED` error code triggers payment flow

## Payment Flow

```
User Signs Up → paymentStatus: 'none'
       ↓
Starts Demo → paymentStatus: 'demo', demoStartedAt: now()
       ↓
10 min expires → API returns 403 with code: 'DEMO_EXPIRED'
       ↓
User Pays → paymentStatus: 'paid', paidAt: now()
       ↓
Full Access Forever
```

## Email Tracking System

### Token Types
| Token | Purpose | Data Encoded |
|-------|---------|--------------|
| Tracking | Open pixel | campaignId, subscriberId |
| Click | Link tracking | campaignId, subscriberId, url |
| Unsubscribe | Opt-out | subscriberId, userId |
| Web Version | Browser view | campaignId, subscriberId, userId |

### Merge Tags
Use in templates - replaced at send time:
```html
Hello {{first_name}},

View in browser: {{web_version_url}}
Unsubscribe: {{unsubscribe_url}}
```

### Tracking Endpoints
```
GET /track/open/:token      → 1x1 PNG, records open
GET /track/click/:token     → 302 redirect, records click
GET /unsubscribe/:token     → HTML confirmation page
POST /api/unsubscribe/:token → Process unsubscribe
GET /api/public/view/:token → Render email in browser
```

## Data Models

### Campaign Statuses
| Status | Description |
|--------|-------------|
| `draft` | Not yet sent, editable |
| `scheduled` | Queued for future send |
| `sending` | Currently being sent |
| `sent` | Delivery complete |
| `paused` | Manually paused |
| `failed` | Send failed |

### Subscriber Statuses
| Status | Description |
|--------|-------------|
| `active` | Can receive emails |
| `unsubscribed` | Opted out |
| `bounced` | Hard bounce received |
| `complained` | Marked as spam |

### Blacklist Reasons
- `hard_bounce` - Email permanently undeliverable
- `complaint` - Recipient marked as spam
- `manual` - Admin added manually
- `spam` - Detected as spam sender

## Business Rules

1. **Multi-tenant Isolation**: Every query MUST filter by `userId`
2. **Demo Duration**: Exactly 10 minutes (`DEMO_DURATION_MS = 600000`)
3. **Payment**: One-time, no subscriptions
4. **Email Provider**: AWS SES only (per-user credentials)
5. **Terms Acceptance**: Required before platform use
6. **Rate Limits**: Public endpoints protected
7. **HTML Sanitization**: All user content sanitized

## API Error Codes

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `DEMO_EXPIRED` | 403 | Demo period ended |
| `UNAUTHORIZED` | 401 | Invalid/missing token |
| `FORBIDDEN` | 403 | No permission |
| `NOT_FOUND` | 404 | Resource doesn't exist |
| `VALIDATION_ERROR` | 400 | Invalid input |
| `RATE_LIMITED` | 429 | Too many requests |
