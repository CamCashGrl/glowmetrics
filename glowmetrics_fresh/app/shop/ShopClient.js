"use client";

import Link from "next/link";
import { PRODUCTS } from "../../lib/shop-products";
import { SHOP_SEO, SHOP_FAQS } from "../../lib/shop-seo";

const PANEL = {
  background: "rgba(13, 17, 38, 0.72)",
  border: "1px solid rgba(255, 255, 255, 0.09)",
  borderRadius: 20,
  padding: "30px 32px",
};

const H2 = {
  fontSize: 24,
  fontWeight: 800,
  letterSpacing: "-0.02em",
  color: "#FFFFFF",
  margin: "0 0 16px",
};

const BODY = {
  fontSize: 15.5,
  lineHeight: 1.65,
  color: "#D7D9EA",
  margin: "0 0 14px",
};

const INLINE_LINK = { color: "#16F4FF", textDecoration: "underline" };

function ProductCard({ product }) {
  return (
    <Link
      href={`/shop/${product.slug}`}
      style={{
        display: "flex",
        flexDirection: "column",
        borderRadius: 20,
        background: "rgba(13, 17, 38, 0.72)",
        border: "1px solid rgba(255, 255, 255, 0.09)",
        boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.05)",
        overflow: "hidden",
        textDecoration: "none",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.boxShadow =
          "0 0 0 1px rgba(22, 244, 255, 0.24), 0 0 24px rgba(22, 244, 255, 0.24), inset 0 0 28px rgba(22, 244, 255, 0.08)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "inset 0 1px 0 rgba(255, 255, 255, 0.05)";
      }}
    >
      <div
        style={{
          width: "100%",
          aspectRatio: "1 / 1",
          background: "rgba(5, 9, 24, 0.72)",
          overflow: "hidden",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.coverImage}
          alt={product.shortTitle}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>

      <div style={{ padding: "16px 18px 20px", flex: 1, display: "flex", flexDirection: "column" }}>
        <h3
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "#FFFFFF",
            margin: "0 0 6px",
            lineHeight: 1.3,
          }}
        >
          {product.shortTitle}
        </h3>

        {SHOP_SEO[product.slug]?.subtitle && (
          <p
            style={{
              fontSize: 13.5,
              lineHeight: 1.5,
              color: "#A7ADCA",
              margin: "0 0 12px",
            }}
          >
            {SHOP_SEO[product.slug].subtitle}
          </p>
        )}

        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "#8D93AA",
            marginBottom: 14,
          }}
        >
          {product.price}
        </span>

        <div
          style={{
            marginTop: "auto",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "10px 18px",
            borderRadius: 14,
            fontSize: 14,
            fontWeight: 800,
            color: "#FFFFFF",
            background: "linear-gradient(90deg, #16F4FF 0%, #7C5CFF 48%, #FF2BAE 100%)",
            boxShadow:
              "0 0 18px rgba(22, 244, 255, 0.28), 0 0 26px rgba(255, 43, 174, 0.24), 0 10px 24px rgba(0, 0, 0, 0.4)",
          }}
        >
          View Details →
        </div>
      </div>
    </Link>
  );
}

export default function ShopClient() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 18% 30%, rgba(0, 229, 255, 0.20), transparent 34%), radial-gradient(circle at 82% 45%, rgba(255, 43, 174, 0.22), transparent 36%), linear-gradient(135deg, #050713 0%, #080B1A 45%, #120719 100%)",
        padding: "64px 24px 96px",
      }}
    >
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <span
            style={{
              display: "inline-block",
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#16F4FF",
              marginBottom: 14,
            }}
          >
            Pretty Profitz Shop
          </span>
          <h1
            style={{
              fontSize: "clamp(28px, 5vw, 42px)",
              fontWeight: 800,
              letterSpacing: "-0.04em",
              lineHeight: 1.05,
              color: "#FFFFFF",
              margin: "0 0 14px",
            }}
          >
            Scripts, kits &amp; tools for cam creators
          </h1>
          <p
            style={{
              fontSize: 16,
              color: "#D7D9EA",
              maxWidth: 560,
              margin: "0 auto",
            }}
          >
            Roleplay bundles, tip menus, trackers, and templates — made by a
            creator, for creators.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 22,
          }}
        >
          {PRODUCTS.map((product) => (
            <ProductCard key={product.slug} product={product} />
          ))}
        </div>

        {/* Indexable copy. The shop used to be a bare card grid, which gave
            search engines a page of images and prices and nothing to rank. */}
        <section style={{ ...PANEL, marginTop: 56 }}>
          <h2 style={H2}>What&apos;s in the Pretty Profitz shop</h2>
          <p style={BODY}>
            Pretty Profitz is the digital product side of CamCash. Everything
            here is written by a working cam creator and sold as an instant
            download through Etsy, so checkout, delivery and buyer protection
            are handled by Etsy rather than by us.
          </p>
          <p style={BODY}>
            The catalogue splits into four groups. <strong>Trackers and
            workbooks</strong> — the VIP client trackers and the Chaturbate
            earnings bundle — are the printable counterparts to the free
            trackers on this site, for creators who plan on paper. <strong>Room
            and menu content</strong> covers the 500 room titles, the 320 tip
            menu ideas and the branding kit: the things buyers search for when
            a room is not converting. <strong>Session scripts</strong> — Daddy&apos;s
            Girl, SPH, GFE JOI, paypig training — give you dialogue for private
            shows and custom orders. <strong>Games and kink guides</strong> round
            it out with dice packs, spin-the-wheel templates, and beginner-level
            bondage and femdom material.
          </p>
          <p style={BODY}>
            If you are here for the numbers rather than the content, start with
            the free tools instead:{" "}
            <Link href="/guides/chaturbate-earnings-tracker" style={INLINE_LINK}>
              the Chaturbate earnings tracker
            </Link>
            ,{" "}
            <Link href="/free-vip-tracker" style={INLINE_LINK}>
              the free VIP tracker
            </Link>
            , or{" "}
            <Link href="/guides/chaturbate-best-hours" style={INLINE_LINK}>
              best hours to stream
            </Link>
            . The workbooks are the offline version of the same work.
          </p>
        </section>

        <section style={{ ...PANEL, marginTop: 22 }}>
          <h2 style={H2}>Shop FAQ</h2>
          {SHOP_FAQS.map((faq) => (
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
              <p style={{ ...BODY, margin: 0 }}>{faq.a}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
