import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getServiceClient } from '@/lib/supabase'
import { signLookupToken, signSubscriberToken, hashToken } from '@/lib/auth'

export const runtime = 'nodejs'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' })

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')!
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = getServiceClient()

  // Idempotency check
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase.from('stripe_events') as any)
    .select('id')
    .eq('id', event.id)
    .single()

  if (existing) {
    return NextResponse.json({ received: true, duplicate: true })
  }

  // Record event before processing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('stripe_events') as any).insert({ id: event.id, type: event.type })

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.payment_status !== 'paid') break

        if (session.metadata?.type === 'lookup') {
          // Issue 24-hour look-up token
          const addressKey = session.metadata.addressKey
          const token = await signLookupToken(addressKey)
          const tokenHash = await hashToken(token)
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from('access_tokens') as any).insert({
            token_hash: tokenHash,
            address_key: addressKey,
            stripe_payment_intent_id: session.payment_intent as string,
            expires_at: expiresAt,
          })
          // Token is delivered via redirect URL with session_id; client retrieves it via /api/token/:session_id
        }

        if (session.metadata?.type === 'subscription' && session.customer_email) {
          const customerId = session.customer as string
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from('users') as any).upsert(
            {
              email: session.customer_email,
              stripe_customer_id: customerId,
              subscription_status: 'active',
            },
            { onConflict: 'email' }
          )
        }
        break
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const status = sub.status === 'active' ? 'active' : sub.status === 'past_due' ? 'past_due' : 'canceled'
        // NOTE(Agent): Stripe SDK 20.x typings omit current_period_end on Subscription directly.
        // Casting through unknown with a minimal interface is safer than `as any`.
        const periodEnd = new Date(
          (sub as unknown as { current_period_end: number }).current_period_end * 1000
        ).toISOString()

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('users') as any)
          .update({ subscription_status: status, subscription_period_end: periodEnd })
          .eq('stripe_customer_id', sub.customer as string)
        break
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err)
    return NextResponse.json({ error: 'Handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
