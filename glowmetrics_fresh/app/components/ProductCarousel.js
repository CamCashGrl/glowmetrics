'use client'

import { useState, useRef, useEffect } from 'react'

export default function ProductCarousel({ products, currentProductId, backgroundColor = 'transparent' }) {
  const scrollContainerRef = useRef(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  const checkScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current
      setCanScrollLeft(scrollLeft > 0)
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10)
    }
  }

  useEffect(() => {
    checkScroll()
    window.addEventListener('resize', checkScroll)
    return () => window.removeEventListener('resize', checkScroll)
  }, [])

  const scroll = (direction) => {
    if (scrollContainerRef.current) {
      const scrollAmount = 320
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      })
      setTimeout(checkScroll, 300)
    }
  }

  const handleScroll = () => {
    checkScroll()
  }

  const s = {
    container: {
      margin: '28px 0',
      padding: '0 8px',
    },
    title: {
      fontSize: '22px',
      fontWeight: 800,
      marginBottom: '20px',
      textAlign: 'center',
    },
    carouselWrapper: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    },
    scrollContainer: {
      display: 'flex',
      gap: '16px',
      overflowX: 'auto',
      scrollBehavior: 'smooth',
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
      flex: 1,
      paddingRight: '8px',
    },
    scrollContainerNoScroll: {
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
      WebkitScrollbar: 'none',
    },
    productCard: {
      flex: '0 0 280px',
      padding: '18px',
      borderRadius: '14px',
      background: 'rgba(255,255,255,.04)',
      border: '1px solid rgba(255,255,255,.08)',
      textAlign: 'center',
      textDecoration: 'none',
      transition: 'all 0.3s ease',
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column',
      minHeight: '200px',
    },
    productCardTitle: {
      fontSize: '16px',
      fontWeight: 700,
      marginBottom: '10px',
      color: '#e2e8f0',
    },
    productDescription: {
      fontSize: '14px',
      opacity: 0.7,
      margin: '0 0 16px 0',
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    productLink: {
      fontSize: '13px',
      color: '#6366f1',
      fontWeight: 600,
      textDecoration: 'none',
    },
    button: {
      position: 'absolute',
      top: '50%',
      transform: 'translateY(-50%)',
      background: 'rgba(99,102,241,0.2)',
      border: '1px solid rgba(99,102,241,0.3)',
      color: '#e2e8f0',
      padding: '10px 12px',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '18px',
      fontWeight: 'bold',
      transition: 'all 0.2s ease',
      zIndex: 10,
    },
    buttonLeft: {
      left: '0',
    },
    buttonRight: {
      right: '0',
    },
    buttonDisabled: {
      opacity: 0.3,
      cursor: 'not-allowed',
    },
  }

  const filteredProducts = products.filter(p => p.id !== currentProductId)

  if (filteredProducts.length === 0) {
    return null
  }

  return (
    <div style={s.container}>
      <div style={s.title}>Other Creator Tools from Pretty Profitz</div>
      <div style={s.carouselWrapper}>
        <button
          onClick={() => scroll('left')}
          style={{
            ...s.button,
            ...s.buttonLeft,
            ...(canScrollLeft ? {} : s.buttonDisabled),
          }}
          disabled={!canScrollLeft}
          aria-label="Scroll left"
        >
          ←
        </button>

        <div
          ref={scrollContainerRef}
          style={{ ...s.scrollContainer, ...s.scrollContainerNoScroll }}
          onScroll={handleScroll}
        >
          {filteredProducts.map((product) => (
            <a
              key={product.id}
              href={product.etsy}
              target="_blank"
              rel="noopener noreferrer sponsored"
              style={s.productCard}
            >
              <div style={s.productCardTitle}>{product.title}</div>
              <p style={s.productDescription}>{product.description}</p>
              <div style={s.productLink}>View on Etsy →</div>
            </a>
          ))}
        </div>

        <button
          onClick={() => scroll('right')}
          style={{
            ...s.button,
            ...s.buttonRight,
            ...(canScrollRight ? {} : s.buttonDisabled),
          }}
          disabled={!canScrollRight}
          aria-label="Scroll right"
        >
          →
        </button>
      </div>
    </div>
  )
}
