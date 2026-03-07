## ADDED Requirements

### Requirement: User can purchase a $2 single-address look-up
The system SHALL offer a one-time $2 payment via Stripe Checkout that grants the user a 24-hour access token scoped to the specific address searched. The token SHALL be delivered via the Stripe Checkout success redirect URL as a query parameter, and also stored in Redis for server-side validation.

#### Scenario: User initiates $2 single look-up payment
- **WHEN** an unauthenticated user attempts to view results for a valid Chicago address
- **THEN** the system SHALL present a paywall screen showing the searched address, the price ($2.00), and a "View Developments" Stripe Checkout button

#### Scenario: Stripe Checkout completed successfully for $2 tier
- **WHEN** a user completes the Stripe Checkout for the $2 product
- **THEN** the system SHALL: (1) receive the `checkout.session.completed` Stripe webhook, (2) generate a signed access token with `{ address: <normalized>, expiresAt: now + 24h }`, (3) store the token in Redis with TTL 86400 seconds, (4) redirect the user to the map view with the token in the URL fragment (not query string) so it is not logged server-side

#### Scenario: $2 access token expires after 24 hours
- **WHEN** a user returns to the app with a $2 access token that is older than 24 hours
- **THEN** the system SHALL return HTTP 401, display "Your access has expired. Purchase a new look-up or subscribe for unlimited access.", and present the paywall again

#### Scenario: $2 token used for a different address
- **WHEN** a user presents a $2 access token for address A but searches address B
- **THEN** the system SHALL reject the request with HTTP 403 and display "This look-up was purchased for a different address. Please purchase access for this address."

### Requirement: User can subscribe for $5/month unlimited access
The system SHALL offer a recurring $5/month Stripe Subscription product that grants the subscriber unlimited address look-ups with no per-address token restriction, valid as long as the subscription is active.

#### Scenario: User initiates $5/month subscription
- **WHEN** an unauthenticated user selects "Subscribe – $5/month" on the paywall
- **THEN** the system SHALL create a Stripe Checkout Session in `subscription` mode with the $5/month price ID and redirect the user to Stripe Checkout

#### Scenario: Stripe subscription activated successfully
- **WHEN** the `customer.subscription.created` Stripe webhook is received with `status: active`
- **THEN** the system SHALL upsert a record in the `subscriptions` table with `{ stripe_customer_id, stripe_subscription_id, status: active, current_period_end }` and associate the record with the user's email (from Stripe)

#### Scenario: Subscriber searches any Chicago address
- **WHEN** a user with an `active` subscription record performs an address search
- **THEN** the system SHALL grant access to the map results without any additional payment, for any valid Chicago address

#### Scenario: Subscription cancelled or payment fails
- **WHEN** Stripe sends a `customer.subscription.updated` or `customer.subscription.deleted` webhook with `status` of `canceled`, `past_due`, or `unpaid`
- **THEN** the system SHALL update the `subscriptions` table record accordingly; the user SHALL lose unlimited access and be presented the paywall on their next search

### Requirement: Stripe webhooks are processed idempotently
The system SHALL verify all incoming Stripe webhook signatures using the Stripe webhook secret and SHALL deduplicate events using the `stripe_event_id`. Processing the same event twice SHALL produce no side effects beyond the first processing.

#### Scenario: Duplicate webhook event received
- **WHEN** the same Stripe event ID is received more than once (e.g., due to Stripe retry logic)
- **THEN** the system SHALL detect the duplicate via the stored `stripe_event_id`, return HTTP 200 to Stripe, and skip reprocessing

#### Scenario: Webhook signature verification fails
- **WHEN** an incoming POST to `/api/webhooks/stripe` has an invalid `Stripe-Signature` header
- **THEN** the system SHALL return HTTP 400 and log a security warning; no database changes SHALL be made

### Requirement: Paywall clearly communicates both pricing tiers
The system SHALL present both payment options ($2 single look-up and $5/month subscription) on the paywall screen with a clear visual hierarchy. The subscription option SHALL be visually highlighted as the better value.

#### Scenario: Paywall rendered for first-time visitor
- **WHEN** an unauthenticated user reaches the paywall after entering a valid Chicago address
- **THEN** the paywall SHALL display: (1) the searched address, (2) a preview blurred map, (3) two CTA buttons — "One-time Look-up · $2" and "Subscribe · $5/mo (Unlimited)" — with the subscription option styled as the primary/recommended action
