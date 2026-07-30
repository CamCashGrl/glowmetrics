// app/api/stripe/plan-config/route.js
import { NextResponse } from 'next/server'
import { isAnnualConfigured } from '../../../../lib/stripePriceConfig'

// Lets the client know which billing options are actually usable right now,
// without ever exposing the underlying price IDs or env var names.
export async function GET() {
  return NextResponse.json({ annualAvailable: isAnnualConfigured() })
}
