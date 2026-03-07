-- Single-address 24hr paid access tokens ($2 look-up)
CREATE TABLE IF NOT EXISTS access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT UNIQUE NOT NULL,  -- SHA-256 of the JWT
  address_key TEXT NOT NULL,        -- normalized address or "lat4:lon4" cache key
  stripe_payment_intent_id TEXT UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_access_tokens_token_hash ON access_tokens(token_hash);
CREATE INDEX idx_access_tokens_expires_at ON access_tokens(expires_at);
