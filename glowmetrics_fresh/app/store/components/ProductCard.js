'use client'

import { T } from './theme'
import { getCoverPath, formatPrice } from '../../../lib/store/products'

export default function ProductCard({ product }) {
  return (
    <a
      href={`/store/${product.slug}`}
      className="store-product-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 16,
        border: `1px solid ${T.border}`,
        background: T.card2,
        textDecoration: 'none',
        overflow: 'hidden',
        transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
      }}
    >
      <div style={{ position: 'relative', overflow: 'hidden', aspectRatio: '3 / 4', background: '#0a0e20' }}>
        <img
          src={getCoverPath(product)}
          alt={`${product.title} cover`}
          className="store-product-cover"
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transition: 'transform 0.35s ease',
          }}
        />
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: T.cyanSoft,
            marginBottom: 8,
          }}
        >
          {product.category}
        </div>

        <h3
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: T.white,
            margin: '0 0 8px',
            lineHeight: 1.3,
            minHeight: '2.6em',
          }}
        >
          {product.title}
        </h3>

        <p
          style={{
            fontSize: 13,
            color: T.text,
            lineHeight: 1.55,
            margin: '0 0 14px',
            flex: 1,
          }}
        >
          {product.shortDescription}
        </p>

        <div style={{ fontSize: 12, color: T.muted, marginBottom: 14 }}>
          {product.format} · {product.pages}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: T.white }}>
            {formatPrice(product.price, product.currency)}
          </span>
          <span
            style={{
              padding: '8px 16px',
              borderRadius: 10,
              border: `1px solid ${T.border}`,
              fontSize: 12,
              fontWeight: 700,
              color: T.cyanSoft,
            }}
          >
            View Details
          </span>
        </div>
      </div>
    </a>
  )
}
