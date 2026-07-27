'use client'

import { useState, useEffect } from 'react'
import UserCounter from '../components/UserCounter'
import SiteFooter from '../components/SiteFooter'
import Button from '../../components/ui/Button'
import { supabase } from '../../lib/supabase'

async function startCheckout(planType, setLoading) {
  setLoading(planType)

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      alert(
        'Your login session could not be found. Please sign in again, then return to pricing.'
      )
      return
    }

    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      credentials: 'same-origin',
      body: JSON.stringify({
        plan_type: planType,
      }),
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      throw new Error(
        data.error || 'Unable to start Stripe Checkout.'
      )
    }

    if (!data.url) {
      throw new Error(
        'Stripe Checkout did not return a payment URL.'
      )
    }

    window.location.assign(data.url)
  } catch (error) {
    alert(
      error?.message ||
        'Something went wrong. Please try again.'
    )
  } finally {
    setLoading(null)
  }
}

const C = {
  bg: '#050713',
  card: 'rgba(10, 14, 32, 0.82)',
  card2: 'rgba(16, 20, 42, 0.72)',
  border: 'rgba(124,92,255,0.15)',
  borderPink: 'rgba(255,43,174,0.2)',
  purple: '#7C5CFF',
  pink: '#FF2BAE',
  cyan: '#16F4FF',
  cyanSoft: '#48E9FF',
  green: '#10B981',
  gold: '#FFC857',
  white: '#FFFFFF',
  text: '#8D93AA',
  muted: '#5E647C',
  gradientPrimary:
    'linear-gradient(90deg, #16F4FF 0%, #55B8FF 28%, #7C5CFF 52%, #FF2BAE 100%)',
}

function CheckLine({ children, color = C.cyan }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        marginBottom: 10,
      }}
    >
      <span
        style={{
          color,
          fontWeight: 700,
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        ✓
      </span>

      <span
        style={{
          color: C.text,
          fontSize: 14,
          lineHeight: 1.55,
        }}
      >
        {children}
      </span>
    </div>
  )
}

function TopBar({ user }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        height: '56px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        background: 'rgba(5,7,19,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom:
          '1px solid rgba(124,92,255,0.2)',
      }}
    >
      <a
        href="/"
        style={{
          textDecoration: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 9,
        }}
      >
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 9,
            background: C.gradientPrimary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            fontWeight: 900,
            color: '#06101A',
            boxShadow:
              '0 0 14px rgba(22,244,255,0.3)',
          }}
        >
          $
        </span>

        <span
          style={{
            fontSize: 17,
            fontWeight: 800,
            color: C.white,
            letterSpacing: '-0.4px',
          }}
        >
          Cam
          <span
            style={{
              background: C.gradientPrimary,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Cash
          </span>
          ™
        </span>
      </a>

      <Button
        as="a"
        href={user ? '/dashboard' : '/landing'}
        style={{
          padding: '8px 18px',
          fontSize: 13,
        }}
      >
        {user
          ? 'Back to Dashboard →'
          : 'Create Free Account →'}
      </Button>
    </div>
  )
}

function PricingSection({
  checkoutLoading,
  setCheckoutLoading,
  user,
}) {
  const freeFeatures = [
    'Track 1 cam platform',
    'Upload tip history by CSV',
    'Basic earnings and session analytics',
    'Live tip detection and real-time alerts',
    'Basic Live Mode coaching',
    'Top 3 fans',
    'Limited recent tip history',
  ]

  const standardFeatures = [
    'Track all supported cam platforms',
    'Full permanent tip history',
    'Expanded fan insights and full fan profiles',
    'Cross-platform earnings comparisons',
    'Advanced Live Mode coaching',
    'Private-session analytics',
    'Churn and re-engagement insights',
    'Full best-time analysis',
    'Stream Planner and Money Map',
    'Advanced recommendations and reports',
  ]

  return (
    <section
      style={{
        padding: '88px 20px 56px',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'flex-start',
      }}
    >
      <div
        style={{
          maxWidth: 1000,
          width: '100%',
          margin: '0 auto',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(290px, 1fr))',
            gap: 24,
            alignItems: 'stretch',
          }}
        >
          <div
            style={{
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 20,
              padding: 28,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <p
              style={{
                color: C.cyan,
                fontSize: 12,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '1.5px',
                margin: '0 0 12px',
              }}
            >
              Free
            </p>

            <div style={{ marginBottom: 8 }}>
              <span
                style={{
                  color: C.white,
                  fontSize: 42,
                  fontWeight: 900,
                }}
              >
                $0
              </span>

              <span
                style={{
                  color: C.text,
                  fontSize: 15,
                  marginLeft: 4,
                }}
              >
                /forever
              </span>
            </div>

            <p
              style={{
                color: C.text,
                fontSize: 14,
                lineHeight: 1.6,
                margin: '0 0 24px',
              }}
            >
              Start tracking your earnings and using
              CamCash without a credit card.
            </p>

            <div
              style={{
                flexGrow: 1,
                marginBottom: 26,
              }}
            >
              {freeFeatures.map((feature) => (
                <CheckLine
                  key={feature}
                  color={C.cyan}
                >
                  {feature}
                </CheckLine>
              ))}
            </div>

            <Button
              as="a"
              href={user ? '/dashboard' : '/landing'}
              variant="secondary"
              style={{
                display: 'block',
                width: '100%',
                padding: '13px 0',
                fontSize: 14,
                textAlign: 'center',
              }}
            >
              {user
                ? 'Continue to Dashboard →'
                : 'Start Free →'}
            </Button>
          </div>

          <div
            style={{
              position: 'relative',
              background: C.card2,
              border: `2px solid ${C.pink}`,
              borderRadius: 20,
              padding: 28,
              display: 'flex',
              flexDirection: 'column',
              boxShadow:
                '0 0 36px rgba(255,43,174,0.16)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: -13,
                right: 22,
                background: C.gradientPrimary,
                color: '#06101A',
                padding: '6px 12px',
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '.6px',
              }}
            >
              Most Popular
            </div>

            <p
              style={{
                color: C.pink,
                fontSize: 12,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '1.5px',
                margin: '0 0 12px',
              }}
            >
              Standard
            </p>

            <div style={{ marginBottom: 6 }}>
              <span
                style={{
                  color: C.white,
                  fontSize: 42,
                  fontWeight: 900,
                }}
              >
                $19.99
              </span>

              <span
                style={{
                  color: C.text,
                  fontSize: 15,
                  marginLeft: 4,
                }}
              >
                /month
              </span>
            </div>

            <p
              style={{
                color: C.cyan,
                fontWeight: 800,
                fontSize: 14,
                margin: '0 0 22px',
              }}
            >
              Or $99 per year
            </p>

            <div
              style={{
                flexGrow: 1,
                marginBottom: 26,
              }}
            >
              {standardFeatures.map((feature) => (
                <CheckLine
                  key={feature}
                  color={C.pink}
                >
                  {feature}
                </CheckLine>
              ))}
            </div>

            <div
              style={{
                display: 'grid',
                gap: 12,
              }}
            >
              <Button
                onClick={() =>
                  startCheckout(
                    'standard_monthly',
                    setCheckoutLoading
                  )
                }
                disabled={checkoutLoading !== null}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '13px 0',
                  fontSize: 14,
                }}
              >
                {checkoutLoading === 'standard_monthly'
                  ? 'Redirecting…'
                  : 'Choose Monthly — $19.99'}
              </Button>

              <Button
                variant="secondary"
                onClick={() =>
                  startCheckout(
                    'standard_annual',
                    setCheckoutLoading
                  )
                }
                disabled={checkoutLoading !== null}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '13px 0',
                  fontSize: 14,
                }}
              >
                {checkoutLoading === 'standard_annual'
                  ? 'Redirecting…'
                  : 'Choose Annual — $99'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function PromiseSection() {
  const promises = [
    'The free tier will always exist and remain genuinely useful',
    'Core live tracking and basic coaching stay free',
    'Standard unlocks full history, deeper insights, and multi-platform tracking',
    'No surprise feature locks after launch',
    '30 days notice before material pricing or plan changes',
    'Built by cam models, for cam models',
  ]

  return (
    <section
      style={{
        padding: '80px 20px',
      }}
    >
      <div
        style={{
          maxWidth: 760,
          margin: '0 auto',
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 20,
          padding: '48px 40px',
        }}
      >
        <h2
          style={{
            color: C.white,
            fontSize: 'clamp(22px, 3.5vw, 32px)',
            fontWeight: 800,
            margin: '0 0 32px',
            letterSpacing: '-0.4px',
          }}
        >
          Our Promise to You
        </h2>

        <div style={{ marginBottom: 36 }}>
          {promises.map((promise) => (
            <div
              key={promise}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                marginBottom: 14,
              }}
            >
              <span
                style={{
                  fontSize: 18,
                  flexShrink: 0,
                }}
              >
                ✅
              </span>

              <span
                style={{
                  color: C.text,
                  fontSize: 15,
                  lineHeight: 1.55,
                }}
              >
                {promise}
              </span>
            </div>
          ))}
        </div>

        <div
          style={{
            borderTop:
              '1px solid rgba(255,255,255,0.06)',
            paddingTop: 28,
          }}
        >
          <p
            style={{
              color: C.purple,
              fontWeight: 700,
              fontSize: 14,
              margin: '0 0 10px',
            }}
          >
            Why we're doing this:
          </p>

          <p
            style={{
              color: C.text,
              fontSize: 15,
              lineHeight: 1.65,
              margin: 0,
            }}
          >
            CamCash is designed to give creators useful
            free tools first, with a clear upgrade path
            for deeper analytics and long-term growth.
          </p>
        </div>
      </div>
    </section>
  )
}

const FAQ_ITEMS = [
  {
    q: 'Will the free tier always be available?',
    a: 'Yes. The free tier will always exist and remain genuinely useful. It includes one tracked platform, CSV uploads, basic earnings and session analytics, live tip detection, alerts, basic Live Mode coaching, top-three fan insights, and limited recent tip history.',
  },
  {
    q: 'How many platforms can I track on the free tier?',
    a: 'The free tier supports one cam platform. Standard unlocks tracking across all supported platforms and adds cross-platform comparisons.',
  },
  {
    q: 'What does the Standard plan include?',
    a: 'Standard includes all supported platforms, full permanent tip history, expanded fan profiles, cross-platform earnings comparisons, advanced Live Mode coaching, private-session analytics, churn and re-engagement insights, full best-time analysis, Stream Planner, Money Map, and advanced reports.',
  },
  {
    q: 'How much is Standard?',
    a: 'Standard is $19.99 per month or $99 per year. The annual plan uses the same Standard features at the lower yearly rate.',
  },
  {
    q: 'Can I switch between monthly and annual billing?',
    a: 'Yes. You can change your billing cycle through your subscription management options.',
  },
  {
    q: 'What platforms does CamCash support?',
    a: 'CamCash currently supports Chaturbate, BongaCams, MyFreeCams, and Stripchat. Additional platforms may be added based on creator demand.',
  },
  {
    q: 'Is my data private?',
    a: 'Yes. Your analytics data is private to your account. CamCash does not sell your personal analytics data.',
  },
]

function FAQSection() {
  const [open, setOpen] = useState(null)

  return (
    <section
      style={{
        padding: '0 20px 72px',
      }}
    >
      <div
        style={{
          maxWidth: 760,
          margin: '0 auto',
        }}
      >
        <h2
          style={{
            color: C.white,
            fontSize: 'clamp(22px, 3.5vw, 32px)',
            fontWeight: 800,
            margin: '0 0 32px',
            textAlign: 'center',
            letterSpacing: '-0.4px',
          }}
        >
          Questions
        </h2>

        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 16,
            overflow: 'hidden',
          }}
        >
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = open === i

            return (
              <div
                key={item.q}
                style={{
                  borderBottom:
                    i < FAQ_ITEMS.length - 1
                      ? '1px solid rgba(255,255,255,0.06)'
                      : 'none',
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    setOpen(isOpen ? null : i)
                  }
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                    padding: '20px 24px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span
                    style={{
                      color: C.white,
                      fontWeight: 600,
                      fontSize: 15,
                      lineHeight: 1.4,
                    }}
                  >
                    {item.q}
                  </span>

                  <span
                    style={{
                      color: C.purple,
                      fontSize: 18,
                      flexShrink: 0,
                      transform: isOpen
                        ? 'rotate(180deg)'
                        : 'rotate(0deg)',
                      transition: 'transform 0.2s',
                      lineHeight: 1,
                    }}
                  >
                    ›
                  </span>
                </button>

                {isOpen && (
                  <div
                    style={{
                      padding: '0 24px 20px',
                    }}
                  >
                    <p
                      style={{
                        color: C.text,
                        fontSize: 14,
                        lineHeight: 1.7,
                        margin: 0,
                      }}
                    >
                      {item.a}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function FinalCTA() {
  return (
    <section
      style={{
        background:
          'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(124,92,255,0.2) 0%, rgba(5,7,19,0) 70%), #050713',
        padding: '80px 20px',
        textAlign: 'center',
      }}
    >
      <h2
        style={{
          color: C.white,
          fontSize: 'clamp(26px, 5vw, 46px)',
          fontWeight: 800,
          margin: '0 0 16px',
          letterSpacing: '-1px',
        }}
      >
        Start free. Grow forever.
      </h2>

      <p
        style={{
          color: C.text,
          fontSize: 16,
          margin: '0 auto 36px',
          maxWidth: 480,
          lineHeight: 1.6,
        }}
      >
        Download the extension free or create a free
        account — no credit card.
      </p>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 14,
          justifyContent: 'center',
          marginBottom: 20,
        }}
      >
        <Button
          as="a"
          href="/landing"
          style={{
            padding: '14px 28px',
          }}
        >
          Create Free Account →
        </Button>

        <Button
          as="a"
          href="/extension"
          variant="secondary"
          style={{
            padding: '14px 28px',
            fontSize: 15,
          }}
        >
          View Extension →
        </Button>
      </div>

      <div style={{ marginBottom: 24 }}>
        <UserCounter variant="pill" />
      </div>

      <p
        style={{
          color: C.muted,
          fontSize: 13,
          margin: 0,
        }}
      >
        Free tier always available · No credit card for
        free account · 4 platforms supported
      </p>
    </section>
  )
}

function AmbientBackground() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,0.3), transparent), radial-gradient(1px 1px at 60% 10%, rgba(255,255,255,0.22), transparent), radial-gradient(1px 1px at 80% 60%, rgba(255,255,255,0.26), transparent), radial-gradient(1px 1px at 35% 80%, rgba(255,255,255,0.18), transparent), radial-gradient(1px 1px at 90% 85%, rgba(255,255,255,0.22), transparent)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          width: 700,
          height: 700,
          top: '-15%',
          right: '-5%',
          background:
            'radial-gradient(circle,rgba(22,244,255,0.08),transparent 65%)',
          filter: 'blur(60px)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          width: 600,
          height: 600,
          bottom: '10%',
          left: '-10%',
          background:
            'radial-gradient(circle,rgba(255,43,174,0.08),transparent 65%)',
          filter: 'blur(60px)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          width: 600,
          height: 600,
          top: '40%',
          left: '40%',
          background:
            'radial-gradient(circle,rgba(124,92,255,0.06),transparent 65%)',
          filter: 'blur(60px)',
        }}
      />
    </div>
  )
}

export default function PricingClient() {
  const [checkoutLoading, setCheckoutLoading] =
    useState(null)

  const [user, setUser] = useState(null)

  useEffect(() => {
    let mounted = true

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (mounted) {
          setUser(session?.user || null)
        }
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (mounted) {
          setUser(session?.user || null)
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  return (
    <div
      style={{
        minHeight: '100vh',
        background: C.bg,
        color: C.white,
        fontFamily:
          "'DM Sans', system-ui, -apple-system, sans-serif",
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      <AmbientBackground />
      <TopBar user={user} />

      <main
        style={{
          position: 'relative',
          zIndex: 1,
        }}
      >
        <PricingSection
          checkoutLoading={checkoutLoading}
          setCheckoutLoading={setCheckoutLoading}
          user={user}
        />

        <PromiseSection />
        <FAQSection />
        <FinalCTA />
      </main>

      <div
        style={{
          position: 'relative',
          zIndex: 1,
        }}
      >
        <SiteFooter />
      </div>
    </div>
  )
}
