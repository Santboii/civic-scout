## ADDED Requirements

### Requirement: Centralized JWT Verification
The system SHALL verify the authenticity and expiration of all access tokens in the middleware/proxy layer.

#### Scenario: Unauthorized Access
- **WHEN** a request to `/api/permits` is made without a token
- **THEN** system returns a 401 Unauthorized status

### Requirement: Subscription Status Enforcement
The system SHALL verify that a subscriber's Stripe subscription is active before granting access to premium data.

#### Scenario: Valid Subscription Access
- **WHEN** a subscriber with an active Stripe subscription makes a request
- **THEN** system allows the request to proceed to the data layer

### Requirement: Address-Specific Token Validation
The system SHALL ensure that a single-use $2 look-up token is only valid for its originally requested address.

#### Scenario: Mismatched Address Token
- **WHEN** a user tries to access a new address with a token issued for a different address
- **THEN** system returns a 403 Forbidden status
