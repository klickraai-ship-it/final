# Implementation Plan: Email Tracking System

- [x] 1. Set up testing infrastructure and core token utilities
- [x] 1.1 Install and configure fast-check property testing library



  - Add fast-check to package.json dependencies
  - Create test configuration file for property tests
  - Set minimum iterations to 100 per property


  - _Requirements: Testing Strategy_

- [x] 1.2 Create HMAC token generation utility functions
  - Implement generateHMACSignature(data, secret) function
  - Implement encodeToken(data, signature) to base64url format



  - Handle TRACKING_SECRET environment variable with fallback
  - Log warning if TRACKING_SECRET not set
  - _Requirements: 1.1, 1.2, 1.5_




- [x] 1.3 Create HMAC token validation utility functions
  - Implement decodeToken(token) from base64url format
  - Implement validateHMACSignature(data, signature, secret) function
  - Implement checkTokenExpiry(expiresAt) function
  - Return null for invalid/expired tokens
  - _Requirements: 1.3, 1.4, 2.2, 2.3_

- [x] 1.4 Write property tests for token generation and validation
  - **Property 1: HMAC signature round-trip**
  - **Validates: Requirements 1.3, 2.4**
  - **Property 2: Invalid signature rejection**
  - **Validates: Requirements 1.4**
  - **Property 3: Token expiry enforcement**
  - **Validates: Requirements 2.3**
  - **Property 4: Base64url encoding**
  - **Validates: Requirements 1.2**
  - **Property 5: Expiry timestamp accuracy**
  - **Validates: Requirements 2.1**

- [x] 2. Implement tracking token types (open, click, unsubscribe, web version)
- [x] 2.1 Implement tracking pixel token generation and validation
  - Create generateTrackingToken(campaignId, subscriberId) function
  - Create decodeTrackingToken(token) function
  - Include 1-year expiry timestamp
  - _Requirements: 4.1, 4.2_

- [x] 2.2 Implement click tracking token generation and validation
  - Create generateClickTrackingToken(campaignId, subscriberId, url) function
  - Create decodeClickTrackingToken(token) function
  - Include destination URL in token payload
  - _Requirements: 5.1, 5.2_

- [x] 2.3 Implement unsubscribe token generation and validation
  - Create generateUnsubscribeToken(subscriberId, userId) function
  - Create decodeUnsubscribeToken(token) function
  - Ensure userId is always included in token
  - Reject tokens without userId (legacy tokens)
  - _Requirements: 3.1, 3.3, 6.1, 6.6_

- [x] 2.4 Implement web version token generation and validation
  - Create generateWebVersionToken(campaignId, subscriberId, userId) function
  - Create decodeWebVersionToken(token) function
  - Ensure userId is always included in token
  - _Requirements: 3.2, 7.1_

- [x] 2.5 Write property tests for multi-tenant token isolation



  - **Property 6: Unsubscribe token contains userId**
  - **Validates: Requirements 3.1, 3.3**
  - **Property 7: Web version token contains userId**
  - **Validates: Requirements 3.2**

- [x] 3. Implement email processing and merge tag replacement
- [x] 3.1 Create merge tag replacement function


  - Implement replaceMergeTags(content, subscriber, campaign) function
  - Replace {{first_name}}, {{last_name}}, {{email}}, {{campaign_name}}
  - Handle null/undefined fields with empty string
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.7_


- [x] 3.2 Implement tracking pixel injection






  - Create injectTrackingPixel(html, token, domain) function
  - Generate 1x1 transparent PNG image tag
  - Insert pixel before closing </body> tag
  - _Requirements: 4.1_


- [x] 3.3 Implement link wrapping for click tracking








  - Create wrapLinksWithTracking(html, options) function
  - Parse HTML and find all <a> tags with href
  - Wrap HTTP and HTTPS links only
  - Generate click tracking tokens for each link
  - Return modified HTML and list of wrapped links

  - _Requirements: 5.1_



- [x] 3.4 Implement unsubscribe link injection


  - Create injectUnsubscribeLink(html, token, domain) function
  - Replace {{unsubscribe_url}} merge tag

  - Generate HMAC-signed unsubscribe URL
  - _Requirements: 6.1, 8.5_

- [x] 3.5 Implement web version link injection



  - Create injectWebVersionLink(html, token, domain) function

  - Replace {{web_version_url}} merge tag
  - Generate HMAC-signed web version URL
  - _Requirements: 7.1, 8.6_

- [x] 3.6 Create main email processing function


  - Implement processEmailForTracking(content, options) function
  - Call replaceMergeTags first
  - Call injectTrackingPixel
  - Call wrapLinksWithTracking
  - Call injectUnsubscribeLink
  - Call injectWebVersionLink
  - Return processed EmailContent object
  - _Requirements: 4.1, 5.1, 6.1, 7.1, 8.1-8.6_

- [-] 3.7 Write property tests for merge tag replacement

  - **Property 30: First name replacement**
  - **Validates: Requirements 8.1**
  - **Property 31: Last name replacement**
  - **Validates: Requirements 8.2**
  - **Property 32: Email replacement**
  - **Validates: Requirements 8.3**
  - **Property 33: Campaign name replacement**
  - **Validates: Requirements 8.4**
  - **Property 34: Null field handling**
  - **Validates: Requirements 8.7**
  - **Property 35: Unsubscribe URL generation**
  - **Validates: Requirements 8.5**
  - **Property 36: Web version URL generation**
  - **Validates: Requirements 8.6**

- [ ] 3.8 Write property tests for email processing
  - **Property 10: Tracking pixel injection**
  - **Validates: Requirements 4.1**
  - **Property 14: Link wrapping completeness**
  - **Validates: Requirements 5.1**
  - **Property 22: Unsubscribe link injection**
  - **Validates: Requirements 6.1**
  - **Property 26: Web version link injection**
  - **Validates: Requirements 7.1**

- [x] 4. Implement tracking pixel endpoint
- [x] 4.1 Create GET /track/open/:token endpoint
  - Decode tracking token to extract campaignId and subscriberId
  - Update campaign_subscribers.opened_at using COALESCE (preserve first touch)
  - Return 1x1 transparent PNG with no-cache headers
  - Handle invalid tokens gracefully (still return PNG)
  - _Requirements: 4.2, 4.3, 4.4, 4.5_

- [ ] 4.2 Write property tests for tracking pixel
  - **Property 11: Tracking pixel round-trip**
  - **Validates: Requirements 4.2**
  - **Property 12: First open preservation (idempotence)**
  - **Validates: Requirements 4.4, 12.1**
  - **Property 13: Tracking pixel response format**
  - **Validates: Requirements 4.5**

- [x] 5. Implement click tracking endpoint with SSRF prevention
- [x] 5.1 Create URL validation utility for SSRF prevention
  - Implement validateClickURL(url) function
  - Check protocol is http or https only
  - Check hostname not in blocked list (localhost, 127.0.0.1, etc.)
  - Check hostname doesn't end in .local, .localhost, .internal
  - Check hostname not a private IP address (10.x, 192.168.x, 172.16-31.x)
  - Check hostname not a metadata endpoint (169.254.169.254, etc.)
  - Perform DNS resolution and check resolved IPs not private
  - Return validation result with error message if blocked
  - _Requirements: 5.6, 5.7, 5.8, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

- [x] 5.2 Create GET /track/click/:token endpoint
  - Decode click tracking token to extract campaignId, subscriberId, url
  - Validate destination URL with SSRF prevention
  - Block redirect if URL validation fails
  - Fetch campaign to get userId
  - Insert record into link_clicks table with userId
  - Update campaign_subscribers.clicked_at using COALESCE (preserve first touch)
  - Redirect to destination URL with HTTP 302
  - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

- [ ] 5.3 Write property tests for click tracking
  - **Property 15: Click tracking round-trip**
  - **Validates: Requirements 5.2, 5.5**
  - **Property 16: First click preservation (idempotence)**
  - **Validates: Requirements 5.4, 12.2**
  - **Property 17: Multiple click recording**
  - **Validates: Requirements 12.3**
  - **Property 18: Invalid protocol rejection**
  - **Validates: Requirements 5.6, 11.1**
  - **Property 19: Private IP rejection**
  - **Validates: Requirements 5.7, 11.2**
  - **Property 20: Internal domain rejection**
  - **Validates: Requirements 11.3**
  - **Property 21: Metadata endpoint rejection**
  - **Validates: Requirements 11.5**

- [x] 6. Implement unsubscribe functionality
- [x] 6.1 Create GET /unsubscribe/:token endpoint
  - Decode unsubscribe token to extract subscriberId and userId
  - Reject tokens without userId (legacy tokens)
  - Query subscriber from database filtered by subscriberId AND userId
  - Return HTML confirmation page with subscriber email
  - Handle invalid tokens with error message
  - _Requirements: 6.2, 6.5, 6.6_

- [x] 6.2 Create POST /api/unsubscribe/:token endpoint
  - Decode unsubscribe token to extract subscriberId and userId
  - Update subscriber status to 'unsubscribed'
  - Filter update query by subscriberId AND userId (multi-tenant isolation)
  - Return JSON success response
  - Handle invalid tokens with error response
  - _Requirements: 6.3, 6.4_

- [ ] 6.3 Write property tests for unsubscribe
  - **Property 8: Cross-tenant unsubscribe prevention**
  - **Validates: Requirements 3.4**
  - **Property 23: Unsubscribe status update**
  - **Validates: Requirements 6.3**
  - **Property 24: Legacy token rejection**
  - **Validates: Requirements 6.6**
  - **Property 25: Invalid unsubscribe token handling**
  - **Validates: Requirements 6.5**

- [x] 7. Implement web version viewing
- [x] 7.1 Create GET /api/public/view/:token endpoint
  - Decode web version token to extract campaignId, subscriberId, userId
  - Query campaign and template from database filtered by userId
  - Return 404 if campaign not found (multi-tenant isolation)
  - Query subscriber from database filtered by userId
  - Replace all merge tags with subscriber data
  - Generate fresh unsubscribe link
  - Insert record into web_version_views with IP and user agent
  - Return rendered HTML with web version banner
  - Handle invalid tokens with error message
  - _Requirements: 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

- [ ] 7.2 Write property tests for web version
  - **Property 9: Cross-tenant web version prevention**
  - **Validates: Requirements 3.5**
  - **Property 27: Web version view recording**
  - **Validates: Requirements 7.5**
  - **Property 28: Web version unsubscribe link generation**
  - **Validates: Requirements 7.4**
  - **Property 29: Deleted campaign handling**
  - **Validates: Requirements 7.7**

- [x] 8. Implement bounce and complaint webhooks
- [x] 8.1 Create POST /webhooks/email/bounce endpoint
  - Parse webhook payload to extract email, campaignId, type
  - Query subscriber by email
  - If hard bounce: update subscriber status to 'bounced'
  - If soft bounce: log but don't update status
  - If campaignId provided: update campaign_subscribers with bounced_at and status
  - Return JSON acknowledgment
  - Handle non-existent emails gracefully
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 8.2 Create POST /webhooks/email/complaint endpoint
  - Parse webhook payload to extract email, campaignId
  - Query subscriber by email
  - Update subscriber status to 'complained'
  - If campaignId provided: update campaign_subscribers with complained_at and status
  - Return JSON acknowledgment
  - Handle non-existent emails gracefully
  - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [ ] 8.3 Write property tests for webhooks
  - **Property 37: Hard bounce status update**
  - **Validates: Requirements 9.1**
  - **Property 38: Soft bounce status preservation**
  - **Validates: Requirements 9.3**
  - **Property 39: Bounce campaign update**
  - **Validates: Requirements 9.2**
  - **Property 40: Complaint status update**
  - **Validates: Requirements 10.1**
  - **Property 41: Complaint campaign update**
  - **Validates: Requirements 10.2**
  - **Property 42: Non-existent email handling**
  - **Validates: Requirements 9.4, 10.3**
  - **Property 43: Webhook response format**
  - **Validates: Requirements 9.5, 10.4**

- [x] 9. Implement data integrity and multi-tenant isolation
- [x] 9.1 Add userId to all tracking database operations
  - Ensure link_clicks inserts include userId from campaign
  - Ensure web_version_views inserts include userId from campaign
  - Ensure all campaign_subscribers updates filter by userId
  - _Requirements: 12.5_

- [x] 9.2 Implement timestamp preservation logic
  - Use COALESCE in SQL updates for opened_at
  - Use COALESCE in SQL updates for clicked_at
  - Verify status updates don't overwrite timestamps
  - _Requirements: 12.1, 12.2, 12.4_

- [ ] 9.3 Write property tests for data integrity
  - **Property 44: Tenant isolation in tracking events**
  - **Validates: Requirements 12.5**
  - **Property 45: Timestamp preservation on status updates**
  - **Validates: Requirements 12.4**

- [ ] 10. Integration testing and security validation
- [ ] 10.1 Write integration tests for complete tracking flows
  - Test email processing end-to-end
  - Test open tracking flow with database updates
  - Test click tracking flow with redirect
  - Test unsubscribe flow with confirmation
  - Test web version flow with rendering
  - Test multi-tenant isolation across all endpoints
  - Test webhook processing flows

- [ ] 10.2 Write security tests for attack prevention
  - Test SSRF attack attempts (localhost, private IPs, metadata endpoints)
  - Test token forgery attempts (modified signatures, modified data)
  - Test cross-tenant attack attempts (access other tenant's data)
  - Verify all attacks blocked

- [ ] 11. Final checkpoint - Ensure all tests pass
  - Run all unit tests and verify passing
  - Run all property tests and verify passing
  - Run all integration tests and verify passing
  - Run all security tests and verify passing
  - Fix any failing tests
  - Ensure all tests pass, ask the user if questions arise.
