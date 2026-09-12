"use client";

import { useState } from "react";
import Link from "next/link";

export default function ProductDetailClient({ product }) {
  // First gallery image is the cover; rest come straight from the live
  // Etsy listing so buyers see the real product before clicking through.
  const allImages = [product.coverImage, ...product.galleryImages];
  const [activeImage, setActiveImage] = useState(0);

  // Breadcrumb schema for SEO
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      {
        '@type': 'ListItem',
        'position': 1,
        'name': 'Home',
        'item': 'https://www.camcashgrl.com'
      },
      {
        '@type': 'ListItem',
        'position': 2,
        'name': 'Shop',
        'item': 'https://www.camcashgrl.com/shop'
      },
      {
        '@type': 'ListItem',
        'position': 3,
        'name': product.shortTitle,
        'item': `https://www.camcashgrl.com/shop/${product.slug}`
      }
    ]
  }

  // Product schema with full details
  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    'name': product.shortTitle,
    'description': product.description,
    'price': product.price.replace('$', ''),
    'priceCurrency': 'USD',
    'url': `https://www.camcashgrl.com/shop/${product.slug}`,
    'image': `https://www.camcashgrl.com${product.coverImage}`,
    'offers': {
      '@type': 'Offer',
      'price': product.price.replace('$', ''),
      'priceCurrency': 'USD',
      'url': product.etsyUrl,
      'availability': 'https://schema.org/InStock'
    },
    'isPartOf': {
      '@type': 'WebSite',
      'name': 'CamCash',
      'url': 'https://www.camcashgrl.com'
    }
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }} />
      <div
        style={{
          minHeight: "100vh",
          background:
            "radial-gradient(circle at 18% 30%, rgba(0, 229, 255, 0.20), transparent 34%), radial-gradient(circle at 82% 45%, rgba(255, 43, 174, 0.22), transparent 36%), linear-gradient(135deg, #050713 0%, #080B1A 45%, #120719 100%)",
          padding: "48px 24px 96px",
        }}
      >
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <Link
          href="/shop"
          style={{
            display: "inline-block",
            fontSize: 14,
            fontWeight: 700,
            color: "#8D93AA",
            textDecoration: "none",
            marginBottom: 28,
          }}
        >
          ← Back to shop
        </Link>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(280px, 480px) 1fr",
            gap: 40,
            alignItems: "start",
          }}
        >
          {/* Gallery */}
          <div>
            <div
              style={{
                borderRadius: 20,
                overflow: "hidden",
                background: "rgba(5, 9, 24, 0.72)",
                border: "1px solid rgba(255, 255, 255, 0.09)",
                aspectRatio: "1 / 1",
                marginBottom: 12,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={allImages[activeImage]}
                alt={product.shortTitle}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {allImages.map((img, i) => (
                <button
                  key={img + i}
                  onClick={() => setActiveImage(i)}
                  style={{
                    width: 64,
                    height: 64,
                    padding: 0,
                    borderRadius: 12,
                    overflow: "hidden",
                    cursor: "pointer",
                    background: "rgba(5, 9, 24, 0.72)",
                    border:
                      i === activeImage
                        ? "2px solid #16F4FF"
                        : "1px solid rgba(255, 255, 255, 0.12)",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Details */}
          <div>
            <h1
              style={{
                fontSize: "clamp(24px, 3.2vw, 34px)",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                lineHeight: 1.1,
                color: "#FFFFFF",
                margin: "0 0 14px",
              }}
            >
              {product.title}
            </h1>

            <div
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: "#16F4FF",
                marginBottom: 24,
              }}
            >
              {product.price}
            </div>

            <a
              href={product.etsyUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "14px 28px",
                borderRadius: 16,
                fontSize: 16,
                fontWeight: 800,
                color: "#FFFFFF",
                textDecoration: "none",
                background: "linear-gradient(90deg, #16F4FF 0%, #7C5CFF 48%, #FF2BAE 100%)",
                boxShadow:
                  "0 0 24px rgba(22, 244, 255, 0.28), 0 0 34px rgba(255, 43, 174, 0.26), 0 14px 34px rgba(0, 0, 0, 0.45)",
                marginBottom: 32,
              }}
            >
              Buy on Etsy →
            </a>

            <div
              style={{
                background: "rgba(13, 17, 38, 0.72)",
                border: "1px solid rgba(255, 255, 255, 0.09)",
                borderRadius: 20,
                padding: "26px 28px",
              }}
            >
              <span
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "#16F4FF",
                  marginBottom: 14,
                }}
              >
                Description
              </span>
              {product.description.split("\n\n").map((para, i) => (
                <p
                  key={i}
                  style={{
                    fontSize: 15,
                    lineHeight: 1.6,
                    color: "#D7D9EA",
                    margin: "0 0 14px",
                  }}
                >
                  {para}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
