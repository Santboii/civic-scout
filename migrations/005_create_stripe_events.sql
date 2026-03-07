-- Idempotency table for Stripe webhook events
CREATE TABLE IF NOT EXISTS stripe_events (
  id TEXT PRIMARY KEY,  -- Stripe event ID (evt_...)
  type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stripe_events_processed_at ON stripe_events(processed_at DESC);
