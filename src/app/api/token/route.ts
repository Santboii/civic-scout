import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getServiceClient } from '@/lib/supabase'
import { signLookupToken, signSubscriberToken, hashToken } from '@/lib/auth'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' })

/**
 * GET /api/token?session_id=cs_...
 * Called after Stripe redirect to exchange a checkout session ID for an access token.
 */
export async function GET(request: NextRequest) {
  const sessionId = new URL(request.url).searchParams.get('session_id')
  if (!sessionId) return NextResponse.json({ error: 'session_id required' }, { status: 400 })

  const session = await stripe.checkout.sessions.retrieve(sessionId)
  if (session.payment_status !== 'paid') {
    return NextResponse.json({ error: 'Payment not completed' }, { status: 402 })
  }

  if (session.metadata?.type === 'lookup') {
    const addressKey = session.metadata.addressKey
    const supabase = getServiceClient()

    // Find stored token hash for this payment intent
    const { data: row } = await supabase
      .from('access_tokens')
      .select('token_hash, expires_at, address_key')
      .eq('stripe_payment_intent_id', session.payment_intent as string)
      .single()

    if (!row) {
      return NextResponse.json({ error: 'Token not yet issued, retry shortly' }, { status: 404 })
    }

    // Re-issue a new token (we can't retrieve the original JWT from the hash)
    const token = await signLookupToken(row.address_key)
    return NextResponse.json({ token, expiresAt: row.expires_at, type: 'lookup' })
  }

  if (session.metadata?.type === 'subscription' && session.customer_email) {
    const supabase = getServiceClient()
    const { data: user } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', session.customer_email)
      .single()

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const token = await signSubscriberToken(user.id, user.email)
    const response = NextResponse.json({ type: 'subscriber' })
    response.cookies.set('ds_session', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    })
    return response
  }

  return NextResponse.json({ error: 'Unknown session type' }, { status: 400 })
}
