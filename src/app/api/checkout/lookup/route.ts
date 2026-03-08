import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { permitCacheKey } from '@/lib/redis'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' })

export async function POST(request: NextRequest) {
  const { lat, lon, address } = await request.json()

  if (!lat || !lon) {
    return NextResponse.json({ error: 'lat and lon required' }, { status: 400 })
  }

  // NOTE(Agent): For single-address lookups, we use 'general' as the domain
  // since the city isn't resolved at checkout time. The actual permit fetch
  // will resolve the city from coordinates at query time.
  const addressKey = permitCacheKey(lat, lon, 'general')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price: process.env.STRIPE_LOOKUP_PRICE_ID!,
        quantity: 1,
      },
    ],
    metadata: {
      type: 'lookup',
      addressKey,
      lat: String(lat),
      lon: String(lon),
      address: address ?? '',
    },
    success_url: `${appUrl}/?session_id={CHECKOUT_SESSION_ID}&lat=${lat}&lon=${lon}&address=${encodeURIComponent(address ?? '')}`,
    cancel_url: `${appUrl}/`,
  })

  return NextResponse.json({ url: session.url })
}
