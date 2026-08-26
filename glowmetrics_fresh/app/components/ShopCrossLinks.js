import Link from "next/link";
import { getProductBySlug } from "../../lib/shop-products";
import { getProductsForPath, SHOP_SEO } from "../../lib/shop-seo";

/**
 * Renders the Pretty Profitz products that reference this page.
 *
 * The pairing is derived from the `tools` links in lib/shop-seo.js, so a
 * tracker or guide never needs its own product list — linking a product to a
 * page automatically links the page back to the product.
 *
 * Usage: <ShopCrossLinks path="/guides/chaturbate-earnings-tracker" />
 */
export default function ShopCrossLinks({ path, limit = 3, heading }) {
  const products = getProductsForPath(path)
    .slice(0, limit)
    .map((slug) => getProductBySlug(slug))
    .filter(Boolean);

  if (products.length === 0) return null;

  return (
    <section
      style={{
        maxWidth: 1080,
        margin: "56px auto 0",
        padding: "28px 30px",
        borderRadius: 20,
        background: "rgba(13, 17, 38, 0.72)",
        border: "1px solid rgba(255, 255, 255, 0.09)",
      }}
    >
      <span
        style={{
          display: "block",
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "#FF2BAE",
          marginBottom: 8,
        }}
      >
        From the Pretty Profitz shop
      </span>
      <h2
        style={{
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: "#FFFFFF",
          margin: "0 0 18px",
        }}
      >
        {heading || "Printable workbooks that pair with this tool"}
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          gap: 18,
        }}
      >
        {products.map((product) => (
          <Link
            key={product.slug}
            href={`/shop/${product.slug}`}
            style={{
              display: "block",
              borderRadius: 16,
              overflow: "hidden",
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              textDecoration: "none",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.coverImage}
              alt={product.shortTitle}
              loading="lazy"
              style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover" }}
            />
            <div style={{ padding: "14px 16px 18px" }}>
              <span
                style={{
                  display: "block",
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#FFFFFF",
                  lineHeight: 1.3,
                  marginBottom: 6,
                }}
              >
                {product.shortTitle}
              </span>
              <span
                style={{
                  display: "block",
                  fontSize: 13.5,
                  lineHeight: 1.5,
                  color: "#A7ADCA",
                  marginBottom: 8,
                }}
              >
                {SHOP_SEO[product.slug]?.subtitle}
              </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#16F4FF" }}>
                {product.price}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
