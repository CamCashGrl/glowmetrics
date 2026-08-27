"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { track } from "../../../lib/track";

const CARD = {
  background: "rgba(13, 17, 38, 0.72)",
  border: "1px solid rgba(255, 255, 255, 0.09)",
  borderRadius: 20,
  padding: "26px 28px",
};

const EYEBROW = {
  display: "block",
  fontSize: 13,
  fontWeight: 800,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "#16F4FF",
  marginBottom: 14,
};

export default function ProductDetailClient({ product, seo, related = [] }) {
  // First gallery image is the cover; rest come straight from the live
  // Etsy listing so buyers see the real product before clicking through.
  const allImages = [product.coverImage, ...product.galleryImages];
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    track("shop_product_viewed", {
      slug: product.slug,
      product: product.shortTitle,
      price: product.price,
    });
  }, [product.slug, product.shortTitle, product.price]);

  return (
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

            {seo?.subtitle && (
              <p
                style={{
                  fontSize: 16.5,
                  lineHeight: 1.55,
                  color: "#B9BEDA",
                  margin: "0 0 18px",
                }}
              >
                {seo.subtitle}
              </p>
            )}

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

            {/* The single most important event on the shop: past this click
                the buyer is on Etsy and nothing here can observe them again.
                Without it, revenue can be attributed to a listing but never
                to the page that sent them. */}
            <a
              href={product.etsyUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                track("shop_etsy_clicked", {
                  slug: product.slug,
                  product: product.shortTitle,
                  price: product.price,
                  source: "product_detail",
                })
              }
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

            {seo?.highlights?.length > 0 && (
              <div style={{ ...CARD, marginBottom: 22 }}>
                <span style={EYEBROW}>What&apos;s inside</span>
                <ul style={{ margin: 0, padding: "0 0 0 20px" }}>
                  {seo.highlights.map((item) => (
                    <li
                      key={item}
                      style={{
                        fontSize: 15,
                        lineHeight: 1.55,
                        color: "#D7D9EA",
                        marginBottom: 8,
                      }}
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

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

        {/* Free tools & guides that pair with this product. These are the
            on-site counterparts to the workbook — the link that makes a
            product page part of the site rather than an Etsy mirror. */}
        {seo?.tools?.length > 0 && (
          <section style={{ ...CARD, marginTop: 44 }}>
            <span style={EYEBROW}>Free tools &amp; guides that pair with this</span>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 14,
              }}
            >
              {seo.tools.map((tool) => (
                <Link
                  key={tool.href}
                  href={tool.href}
                  style={{
                    display: "block",
                    padding: "14px 16px",
                    borderRadius: 14,
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(22, 244, 255, 0.18)",
                    textDecoration: "none",
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      fontSize: 15,
                      fontWeight: 700,
                      color: "#16F4FF",
                      marginBottom: 4,
                    }}
                  >
                    {tool.label}
                  </span>
                  <span style={{ fontSize: 13.5, lineHeight: 1.5, color: "#A7ADCA" }}>
                    {tool.blurb}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* FAQ — mirrored into FAQPage schema in page.js */}
        {seo?.faqs?.length > 0 && (
          <section style={{ ...CARD, marginTop: 22 }}>
            <h2
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: "#FFFFFF",
                letterSpacing: "-0.02em",
                margin: "0 0 18px",
              }}
            >
              {product.shortTitle} — questions buyers ask
            </h2>
            {seo.faqs.map((faq) => (
              <div key={faq.q} style={{ marginBottom: 18 }}>
                <h3
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#FFFFFF",
                    margin: "0 0 6px",
                  }}
                >
                  {faq.q}
                </h3>
                <p style={{ fontSize: 15, lineHeight: 1.6, color: "#D7D9EA", margin: 0 }}>
                  {faq.a}
                </p>
              </div>
            ))}
          </section>
        )}

        {related.length > 0 && (
          <section style={{ marginTop: 44 }}>
            <h2
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: "#FFFFFF",
                letterSpacing: "-0.02em",
                margin: "0 0 18px",
              }}
            >
              Creators who bought this also looked at
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 18,
              }}
            >
              {related.map((item) => (
                <Link
                  key={item.slug}
                  href={`/shop/${item.slug}`}
                  onClick={() =>
                    track("shop_product_clicked", {
                      slug: item.slug,
                      product: item.shortTitle,
                      price: item.price,
                      source: "related",
                      from_slug: product.slug,
                    })
                  }
                  style={{
                    display: "block",
                    borderRadius: 16,
                    overflow: "hidden",
                    background: "rgba(13, 17, 38, 0.72)",
                    border: "1px solid rgba(255, 255, 255, 0.09)",
                    textDecoration: "none",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.coverImage}
                    alt={item.shortTitle}
                    style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover" }}
                  />
                  <div style={{ padding: "12px 14px 16px" }}>
                    <span
                      style={{
                        display: "block",
                        fontSize: 14.5,
                        fontWeight: 700,
                        color: "#FFFFFF",
                        lineHeight: 1.3,
                        marginBottom: 4,
                      }}
                    >
                      {item.shortTitle}
                    </span>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: "#8D93AA" }}>
                      {item.price}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
