'use client'

import { useMemo, useState } from 'react'
import { T } from './components/theme'
import StoreTopBar from './components/StoreTopBar'
import StoreHero from './components/StoreHero'
import CategoryFilters from './components/CategoryFilters'
import ProductGrid from './components/ProductGrid'
import StoreTrustStrip from './components/StoreTrustStrip'
import SiteFooter from '../components/SiteFooter'
import { getAllProducts } from '../../lib/store/products'

export default function StoreClient() {
  const [activeCategory, setActiveCategory] = useState('All Products')
  const products = useMemo(() => getAllProducts(), [])

  const filtered = useMemo(() => {
    if (activeCategory === 'All Products') return products
    return products.filter((p) => p.category === activeCategory)
  }, [products, activeCategory])

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text }}>
      <StoreTopBar />
      <StoreHero />
      <StoreTrustStrip />
      <div style={{ paddingTop: 32 }}>
        <h2
          style={{
            maxWidth: 1180,
            margin: '0 auto',
            padding: '0 32px 20px',
            fontSize: 20,
            fontWeight: 800,
            color: T.white,
          }}
        >
          Featured Products
        </h2>
        <CategoryFilters active={activeCategory} onChange={setActiveCategory} />
        <ProductGrid products={filtered} />
      </div>
      <SiteFooter />

      <style>{`
        .store-product-card:hover {
          transform: translateY(-4px);
          border-color: ${T.borderPink};
          box-shadow: 0 16px 36px rgba(255,43,174,0.14);
        }
        .store-product-card:hover .store-product-cover {
          transform: scale(1.04);
        }
        .store-product-card:focus-visible,
        .store-product-grid a:focus-visible,
        button:focus-visible,
        a:focus-visible {
          outline: 2px solid ${T.cyanSoft};
          outline-offset: 2px;
        }
        @media (max-width: 1024px) {
          .store-product-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 560px) {
          .store-product-grid { grid-template-columns: 1fr !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .store-product-card,
          .store-product-cover {
            transition: none !important;
          }
        }
      `}</style>
    </div>
  )
}
