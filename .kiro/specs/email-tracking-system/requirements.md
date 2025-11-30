# Requirements Document

## Introduction

The Email Tracking System provides secure, HMAC-signed token-based tracking for email campaigns in a multi-tenant environment. The system enables tracking of email opens, link clicks, unsubscribes, and web version views while maintaining strict tenant isolation and security through cryptographic signatures.

## Glossary

- **System**: The Email Tracking System
- **HMAC**: Hash-based Message Authentication Code using SHA-256
- **Token**: A base64url-encoded string containing data and HMAC signature
- **Tracking Secret**: A cryptographic secret used for HMAC signature generation
- **Tenant**: A user account with isolated data (identified by userId)
- **Campaign**: An email sending operation targeting multiple subscribers
- **Subscriber**: An email recipient in the system
- **Tracking Pixel**: A 1x1 transparent PNG image used to track email opens
- **Merge Tag**: A placeholder in email content replaced with subscriber data (e.g., {{first_name}})
- **Web Version**: A browser-viewable version of an email campaign
- **Click Tracking**: Recording when a subscriber clicks a link in an email
- **Open Tracking**: Recording when a subscriber opens an email
- **Unsubscribe Token**: An HMAC-signed token allowing a subscriber to opt-out
- **Web Version Token**: An HMAC-signed token allowing browser viewing of an email
- **Click Token**: An HMAC-signed token wrapping a target URL for click tracking
- **Open Token**: An HMAC-signed token for tracking email opens via pixel

## Requirements

### Requirement 1

**User Story:** As a campaign sender, I want to track when subscribers open my emails, so that I can measure engagement and campaign effectiveness.

#### Acceptance Criteria

1. WHEN the System generates an open tracking token THEN the System SHALL create an HMAC-SHA256 signature from campaignId, subscriberId, and expiry timestamp
2. WHEN the System generates an open tracking token THEN the System SHALL encode the token as base64url format
3. WHEN a subscriber loads an email THEN the System SHALL inject a 1x1 tracking pixel with the open tracking token
4. WHEN the System receives a tracking pixel request THEN the System SHALL validate the HMAC signature before recording the open
5. WHEN the System receives a tracking pixel request with an expired token THEN the System SHALL reject the token and return the pixel without recording
6. WHEN the System records an email open THEN the System SHALL update the campaign_subscribers table with the first open timestamp only

### Requirement 2

**User Story:** As a campaign sender, I want to track when subscribers click links in my emails, so that I can understand which content drives engagement.

#### Acceptance Criteria

1. WHEN the System wraps a link for tracking THEN the System SHALL generate an HMAC-signed token containing campaignId, subscriberId, URL hash, expiry, and base64url-encoded target URL
2. WHEN the System wraps a link for tracking THEN the System SHALL replace the original href with a tracking URL containing the token
3. WHEN the System receives a click tracking request THEN the System SHALL validate the HMAC signature before processing
4. WHEN the System receives a click tracking request THEN the System SHALL verify the URL hash matches the decoded URL
5. WHEN the System receives a click tracking request with a valid token THEN the System SHALL record the click in the link_clicks table with the tenant's userId
6. WHEN the System receives a click tracking request with a valid token THEN the System SHALL redirect the subscriber to the original target URL
7. WHEN the System receives a click tracking request with an invalid or expired token THEN the System SHALL return a 400 error without redirecting

### Requirement 3

**User Story:** As a subscriber, I want to unsubscribe from emails using a secure link, so that I can stop receiving unwanted communications.

#### Acceptance Criteria

1. WHEN the System generates an unsubscribe token THEN the System SHALL create an HMAC-SHA256 signature from subscriberId, userId, and expiry timestamp
2. WHEN the System generates an unsubscribe token THEN the System SHALL include the tenant userId for multi-tenant isolation
3. WHEN the System injects an unsubscribe link THEN the System SHALL replace the {{unsubscribe_url}} merge tag with the HMAC-signed token URL
4. WHEN a subscriber visits an unsubscribe link THEN the System SHALL validate the HMAC signature and expiry before displaying the confirmation page
5. WHEN a subscriber confirms unsubscription THEN the System SHALL update the subscriber status to 'unsubscribed' in the database
6. WHEN the System receives an unsubscribe request with an invalid token THEN the System SHALL return a 400 error

### Requirement 4

**User Story:** As a subscriber, I want to view emails in my browser, so that I can read them when my email client doesn't render HTML properly.

#### Acceptance Criteria

1. WHEN the System generates a web version token THEN the System SHALL create an HMAC-SHA256 signature from campaignId, subscriberId, userId, and expiry timestamp
2. WHEN the System processes an email for sending THEN the System SHALL replace the {{web_version_url}} merge tag with the HMAC-signed web version URL
3. WHEN a subscriber visits a web version link THEN the System SHALL validate the HMAC signature, expiry, and userId before rendering
4. WHEN the System renders a web version THEN the System SHALL replace all merge tags with the subscriber's data
5. WHEN the System renders a web version THEN the System SHALL generate a fresh unsubscribe link for that subscriber
6. WHEN the System receives a web version request with an invalid token THEN the System SHALL return a 404 error

### Requirement 5

**User Story:** As a system administrator, I want all tracking tokens to be cryptographically signed, so that attackers cannot forge or tamper with tracking data.

#### Acceptance Criteria

1. WHEN the System generates any tracking token THEN the System SHALL use HMAC-SHA256 with a secure secret key
2. WHEN the System validates any tracking token THEN the System SHALL verify the HMAC signature matches the expected value
3. WHEN the System detects a signature mismatch THEN the System SHALL reject the token and log the security event
4. WHEN the System starts without a TRACKING_SECRET environment variable THEN the System SHALL generate a random secret and log a warning
5. WHEN the System encodes token data THEN the System SHALL use base64url encoding for URL safety

### Requirement 6

**User Story:** As a tenant user, I want my tracking data isolated from other tenants, so that my campaign analytics remain private and secure.

#### Acceptance Criteria

1. WHEN the System generates an unsubscribe token THEN the System SHALL include the tenant userId in the token data
2. WHEN the System generates a web version token THEN the System SHALL include the tenant userId in the token data
3. WHEN the System records a link click THEN the System SHALL query the campaign to retrieve the tenant userId and store it with the click record
4. WHEN the System processes an unsubscribe request THEN the System SHALL filter the database query by both subscriberId AND userId from the token
5. WHEN the System processes a web version request THEN the System SHALL filter all database queries by the userId from the token

### Requirement 7

**User Story:** As a campaign sender, I want to replace merge tags in emails with subscriber data, so that I can personalize email content.

#### Acceptance Criteria

1. WHEN the System processes an email for sending THEN the System SHALL replace {{first_name}} with the subscriber's first name or empty string
2. WHEN the System processes an email for sending THEN the System SHALL replace {{last_name}} with the subscriber's last name or empty string
3. WHEN the System processes an email for sending THEN the System SHALL replace {{email}} with the subscriber's email address
4. WHEN the System processes an email for sending THEN the System SHALL replace {{full_name}} with the subscriber's full name or empty string
5. WHEN the System processes an email for sending THEN the System SHALL replace merge tags in both subject line and HTML content

### Requirement 8

**User Story:** As a system administrator, I want tracking tokens to expire after a reasonable time, so that old links cannot be used indefinitely.

#### Acceptance Criteria

1. WHEN the System generates an open tracking token THEN the System SHALL set expiry to 90 days from generation
2. WHEN the System generates a click tracking token THEN the System SHALL set expiry to 90 days from generation
3. WHEN the System generates an unsubscribe token THEN the System SHALL set expiry to 365 days from generation
4. WHEN the System generates a web version token THEN the System SHALL set expiry to 365 days from generation
5. WHEN the System validates any token THEN the System SHALL check if the current timestamp exceeds the expiry timestamp
6. WHEN the System detects an expired token THEN the System SHALL reject the token and return an appropriate error

### Requirement 9

**User Story:** As a security engineer, I want click tracking to prevent SSRF attacks, so that attackers cannot use the system to scan internal networks.

#### Acceptance Criteria

1. WHEN the System receives a click tracking request THEN the System SHALL validate the target URL protocol is http or https only
2. WHEN the System receives a click tracking request THEN the System SHALL block redirects to localhost, loopback, and private IP ranges
3. WHEN the System receives a click tracking request THEN the System SHALL block redirects to internal metadata endpoints (169.254.169.254, metadata.google.internal)
4. WHEN the System receives a click tracking request THEN the System SHALL perform DNS resolution and block if the hostname resolves to a private IP
5. WHEN the System detects a blocked URL THEN the System SHALL return a 400 error without redirecting
6. WHEN the System fails to resolve DNS for a hostname THEN the System SHALL block the redirect and return a 400 error

### Requirement 10

**User Story:** As a campaign sender, I want to process email webhooks for bounces and complaints, so that I can maintain list hygiene and sender reputation.

#### Acceptance Criteria

1. WHEN the System receives a hard bounce webhook THEN the System SHALL update the subscriber status to 'bounced'
2. WHEN the System receives a bounce webhook with a campaignId THEN the System SHALL update the campaign_subscribers record with bounce timestamp and status
3. WHEN the System receives a complaint webhook THEN the System SHALL update the subscriber status to 'complained'
4. WHEN the System receives a complaint webhook with a campaignId THEN the System SHALL update the campaign_subscribers record with complaint timestamp and status
5. WHEN the System processes any webhook THEN the System SHALL return a 200 response with {received: true}

### Requirement 11

**User Story:** As a campaign sender, I want to send emails in batches with rate limiting, so that I can avoid overwhelming email providers and maintain deliverability.

#### Acceptance Criteria

1. WHEN the System processes a campaign THEN the System SHALL divide subscribers into batches of configurable size (default 100)
2. WHEN the System completes a batch THEN the System SHALL wait a configurable delay (default 1000ms) before processing the next batch
3. WHEN the System sends an email to a subscriber THEN the System SHALL process merge tags, inject tracking, and send via the email provider
4. WHEN the System fails to send an email THEN the System SHALL log the error and continue processing remaining subscribers
5. WHEN the System completes campaign processing THEN the System SHALL return counts of sent and failed emails
