'use client'

import { T } from './theme'
import { getCoverPath, formatPrice } from '../../../lib/store/products'
import ProductCard from './ProductCard'
import CheckoutComingSoon from './CheckoutComingSoon'

export default function ProductDetails({ product, related }) {
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 32px 100px' }}>
      <nav aria-label="Breadcrumb" style={{ marginBottom: 24 }}>
        <a href="/store" style={{ fontSize: 13, color: T.text, textDecoration: 'none' }}>
          ← Back to Store
        </a>
      </nav>

      <div className="store-detail-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48 }}>
        <div
          style={{
            borderRadius: 20,
            overflow: 'hidden',
            border: `1px solid ${T.border}`,
            background: T.card,
            boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
          }}
        >
          <img
            src={getCoverPath(product)}
            alt={`${product.title} cover`}
            style={{ display: 'block', width: '100%', height: 'auto' }}
          />
        </div>

        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: T.cyanSoft,
              marginBottom: 10,
            }}
          >
            {product.category}
          </div>

          <h1 style={{ fontSize: 30, fontWeight: 800, color: T.white, lineHeight: 1.2, margin: '0 0 14px' }}>
            {product.title}
          </h1>

          <div style={{ fontSize: 26, fontWeight: 800, color: T.white, marginBottom: 16 }}>
            {formatPrice(product.price, product.currency)}
          </div>

          <p style={{ fontSize: 14, color: T.text, lineHeight: 1.65, margin: '0 0 24px' }}>
            {product.shortDescription}
          </p>

          <div
            style={{
              borderRadius: 14,
              border: `1px solid ${T.border}`,
              background: T.card2,
              padding: 20,
              marginBottom: 20,
            }}
          >
            <h2
              style={{
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: T.white,
                margin: '0 0 12px',
              }}
            >
              What&rsquo;s Included
            </h2>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {product.included.map((item) => (
                <li
                  key={item}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    fontSize: 13,
                    color: T.text,
                    lineHeight: 1.55,
                    marginBottom: 8,
                  }}
                >
                  <span style={{ color: T.pink, fontWeight: 700, flexShrink: 0 }}>✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div style={{ fontSize: 13, color: T.muted, marginBottom: 20, lineHeight: 1.6 }}>
            <strong style={{ color: T.text }}>Format:</strong> {product.format} &nbsp;·&nbsp;{' '}
            <strong style={{ color: T.text }}>Length:</strong> {product.pages}
          </div>

          <div
            style={{
              fontSize: 12,
              color: T.muted,
              lineHeight: 1.6,
              marginBottom: 24,
              borderLeft: `2px solid ${T.border}`,
              paddingLeft: 12,
            }}
          >
            This is a digital download for personal use only. Redistribution, resale or public
            sharing of these files is not permitted.
            {product.adultOnly && (
              <>
                <br />
                Adults only (18+). This content contains adult themes intended for consenting adults.
              </>
            )}
          </div>

          <CheckoutComingSoon />
        </div>
      </div>

      {related.length > 0 && (
        <div style={{ marginTop: 72 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: T.white, marginBottom: 20 }}>
            More in {product.category}
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${Math.min(related.length, 3)}, 1fr)`,
              gap: 20,
            }}
            className="store-related-grid"
          >
            {related.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 780px) {
          .store-detail-grid { grid-template-columns: 1fr !important; }
          .store-related-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
