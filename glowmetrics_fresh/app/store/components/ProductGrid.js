'use client'

import { T } from './theme'
import ProductCard from './ProductCard'

export default function ProductGrid({ products }) {
  if (products.length === 0) {
    return (
      <div
        id="product-grid"
        style={{
          maxWidth: 1180,
          margin: '0 auto',
          padding: '40px 32px 100px',
          textAlign: 'center',
          color: T.text,
          scrollMarginTop: 88,
        }}
      >
        No products in this category yet.
      </div>
    )
  }

  return (
    <div
      id="product-grid"
      className="store-product-grid"
      style={{
        maxWidth: 1180,
        margin: '0 auto',
        padding: '8px 32px 100px',
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 20,
        scrollMarginTop: 88,
      }}
    >
      {products.map((product) => (
        <ProductCard key={product.slug} product={product} />
      ))}
    </div>
  )
}
