"use client";

import Link from "next/link";

export function ProductCard({ product }) {
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
