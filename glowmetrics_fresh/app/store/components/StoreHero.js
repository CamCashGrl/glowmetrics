'use client'

import { T } from './theme'
import { getAllProducts, getCoverPath } from '../../../lib/store/products'

const HERO_COVER_IDS = ['branding-kit', 'tip-menu', 'room-titles', 'spin-wheel']

export default function StoreHero() {
  const products = getAllProducts()
  const heroCovers = HERO_COVER_IDS.map((id) => products.find((p) => p.id === id)).filter(Boolean)

  return (
    <section
      style={{
        maxWidth: 1180,
        margin: '0 auto',
        padding: '48px 32px 32px',
        display: 'grid',
        gridTemplateColumns: '1.1fr 0.9fr',
        gap: 40,
        alignItems: 'center',
      }}
      className="store-hero-grid"
    >
      <div>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 14px',
            borderRadius: 999,
            border: `1px solid ${T.borderPink}`,
            background: 'rgba(255,43,174,0.08)',
            marginBottom: 18,
          }}
        >
          <span
            style={{
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontStyle: 'italic',
              fontSize: 14,
              color: T.gold,
            }}
          >
            Pretty Profitz
          </span>
        </div>

        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: T.pink,
            marginBottom: 12,
          }}
        >
          CamCash Store
        </div>

        <h1
          style={{
            fontSize: 'clamp(30px, 4vw, 44px)',
            fontWeight: 800,
            color: T.white,
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
            margin: '0 0 16px',
          }}
        >
          Tools Made for Creators Who Want{' '}
          <span
            style={{
              background: T.gradientPrimary,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            More
          </span>
        </h1>

        <p style={{ fontSize: 15, color: T.text, lineHeight: 1.65, maxWidth: 460, margin: '0 0 28px' }}>
          Ready-to-use workbooks, scripts, trackers and cam-room tools built to help you stay
          organized, look professional and earn more.
        </p>

        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <a
            href="#product-grid"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '13px 26px',
              borderRadius: 12,
              background: T.gradientPrimary,
              color: '#06101A',
              fontWeight: 800,
              fontSize: 14,
              textDecoration: 'none',
              boxShadow: '0 0 18px rgba(255,43,174,0.22)',
            }}
          >
            Shop All Products →
          </a>
          <a
            href="#category-filters"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '13px 24px',
              borderRadius: 12,
              border: `1px solid ${T.border}`,
              background: 'rgba(255,255,255,0.03)',
              color: T.white,
              fontWeight: 700,
              fontSize: 14,
              textDecoration: 'none',
            }}
          >
            Browse Categories ▦
          </a>
        </div>
      </div>

      <div
        style={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 16,
          padding: 8,
        }}
        aria-hidden="true"
      >
        {heroCovers.map((product, i) => (
          <div
            key={product.id}
            style={{
              borderRadius: 16,
              overflow: 'hidden',
              border: `1px solid ${T.border}`,
              boxShadow: '0 20px 44px rgba(0,0,0,0.45)',
              transform: i % 2 === 1 ? 'translateY(22px)' : 'none',
              background: T.card,
            }}
          >
            <img
              src={getCoverPath(product)}
              alt=""
              style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', aspectRatio: '3 / 4' }}
            />
          </div>
        ))}
      </div>

      <style>{`
        @media (max-width: 860px) {
          .store-hero-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  )
}
