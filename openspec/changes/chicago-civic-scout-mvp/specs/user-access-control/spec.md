## ADDED Requirements

### Requirement: System enforces access gates before returning permit data
The system SHALL validate an access token or active subscription on every request to the permit lookup API route before returning any permit data. Requests without a valid token or subscription SHALL receive HTTP 401 and be redirected to the paywall.

#### Scenario: Request with valid $2 single-look-up token
- **WHEN** a request to `/api/permits` includes a valid, unexpired $2 access token in the `Authorization: Bearer {token}` header
- **THEN** the system SHALL validate the token against Redis (`GET access_token:{token}`), confirm the token's `address` field matches the requested address, and return the permit results

#### Scenario: Request with active subscription
- **WHEN** a request to `/api/permits` includes a valid subscriber session identifier (email + Stripe customer ID stored in a session cookie or JWT)
- **THEN** the system SHALL look up the `subscriptions` table for the customer ID, confirm `status = 'active'` and `current_period_end > now()`, and return the permit results for any valid Chicago address

#### Scenario: Request with no token or session
- **WHEN** a request to `/api/permits` is made without any `Authorization` header or subscriber session
- **THEN** the system SHALL return HTTP 401 with `{ error: "UNAUTHENTICATED", message: "Purchase access to view development data." }`

#### Scenario: Request with expired $2 token
- **WHEN** a request to `/api/permits` includes a $2 access token that no longer exists in Redis (TTL expired)
- **THEN** the system SHALL return HTTP 401 with `{ error: "TOKEN_EXPIRED", message: "Your 24-hour access has expired." }`

### Requirement: System differentiates guest, paid look-up, and subscriber tiers
The system SHALL maintain three distinct access tiers and enforce different capabilities for each.

| Tier | Trigger | Capabilities |
|---|---|---|
| Guest | No token/session | Address input only; paywall shown; no permit data |
| Paid Look-up | Valid $2 token | Permit map for the specific purchased address; valid 24 hours |
| Subscriber | Active Stripe subscription | Unlimited permit maps for any valid Chicago address |

#### Scenario: Guest user views the homepage
- **WHEN** an unauthenticated user lands on the homepage
- **THEN** the system SHALL display the address search input, a marketing tagline, and sample/blurred map imagery; no permit data SHALL be exposed

#### Scenario: Paid look-up user attempts to search a second address
- **WHEN** a user with a valid $2 token for address A attempts to search address B
- **THEN** the system SHALL display the paywall for address B with a prompt: "You have a look-up for [Address A]. Purchase a new look-up or subscribe for unlimited access."

#### Scenario: Subscriber searches unlimited addresses
- **WHEN** an active subscriber searches any valid Chicago address
- **THEN** the system SHALL return permit results without any additional payment prompt, for every search within the subscription period

### Requirement: Access tokens are stored and validated server-side
The system SHALL store $2 access tokens in Upstash Redis (not solely in the client) to enable server-side revocation and prevent client-side forgery. The token payload SHALL be a cryptographically signed JWT (HS256) containing `{ address, expiresAt, tier: "single" }` signed with `ACCESS_TOKEN_SECRET`.

#### Scenario: Access token generated after successful $2 payment
- **WHEN** the `checkout.session.completed` webhook is received for a $2 purchase
- **THEN** the system SHALL generate a JWT signed with `ACCESS_TOKEN_SECRET`, store it in Redis as `access_token:{jti}` with TTL 86400 seconds, and include it in the Stripe success redirect URL as a URL fragment

#### Scenario: Access token signature tampered
- **WHEN** a request to `/api/permits` includes a JWT with a valid structure but invalid signature
- **THEN** the system SHALL return HTTP 401 with `{ error: "INVALID_TOKEN" }` and log a security warning

### Requirement: Subscriber sessions are persisted via HTTP-only cookies
The system SHALL store subscriber identity in an HTTP-only, Secure, SameSite=Strict signed session cookie containing `{ stripeCustomerId, email }`. The cookie SHALL be issued after the subscription activation webhook is processed and the user returns to the app via the Stripe success redirect.

#### Scenario: Subscriber returns to app after subscribing
- **WHEN** a user is redirected back from Stripe Checkout after successful subscription and the webhook has already been processed
- **THEN** the server SHALL set an HTTP-only session cookie and redirect the user to the address search page

#### Scenario: Session cookie present on subsequent visits
- **WHEN** a returning subscriber visits the app with a valid session cookie
- **THEN** the system SHALL automatically recognize the subscriber, skip the paywall, and display the address search input with a "Subscriber" badge in the header

#### Scenario: Subscriber logs out
- **WHEN** a subscriber clicks "Log out"
- **THEN** the system SHALL clear the session cookie and redirect to the homepage; the user SHALL be treated as a guest on subsequent visits
