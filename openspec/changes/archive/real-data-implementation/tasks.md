## 1. Environment & Infrastructure

- [x] 1.1 Verify presence of `SOCRATA_APP_TOKEN` in `.env.local`
- [x] 1.2 Verify Upstash Redis credentials (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`)
- [x] 1.3 Verify Supabase service role key and URL for search logging
- [x] 1.4 Set `MOCK_DATA=false` in `.env.local` and restart dev server

## 2. API & Data Integration

- [x] 2.1 Remove mock logic from `src/app/api/geocode/route.ts` and finalize Nominatim integration
- [x] 2.2 Remove mock permit data from `src/app/api/permits/route.ts`
- [x] 2.3 Implement SODA query with `within_circle` filter in `src/lib/socrata.ts`
- [x] 2.4 Finalize `transformPermit` and `classifyPermit` for live Socrata fields
- [x] 2.5 Re-enable `enrichWithCookCounty` for RED severity permits in the permit route

## 3. Caching & Persistence

- [x] 3.1 Implement grid-based Redis caching in `src/app/api/permits/route.ts` using `lat4:lon4` key pattern
- [x] 3.2 Implement stale-key fallback logic for Socrata API failures
- [x] 3.3 Ensure search logging to Supabase `searches` table is active and correct

## 4. Access Control & Middleware

- [x] 4.1 Remove mock token bypass in `src/lib/auth.ts` (`verifyToken`)
- [x] 4.2 Re-enable strict address validation in `src/proxy.ts` (remove mock bypass)
- [x] 4.3 Verify Stripe subscription verification logic in `src/lib/auth.ts` or `src/proxy.ts`

## 5. UI & Cleanup

- [x] 5.1 Remove "Dev: Use Mock Token" button from `src/components/PaymentModal.tsx`
- [x] 5.2 Remove "✨ Showing Simulated Data" indicator from `src/app/page.tsx`
- [x] 5.3 Conduct end-to-end smoke test with a real Chicago address (verify geocode → paywall → data)
