import { PRODUCTS } from "../../lib/shop-products";
import ProductCard from "./ProductCard";

export const metadata = {
  title: "Shop | Cam Creator Scripts, Trackers & Tip Menu Templates | Pretty Profitz",
  description:
    "Roleplay scripts, VIP client trackers, tip menu templates, and earnings tools for cam models and adult content creators. Instant digital downloads made by a creator, for creators.",
  keywords:
    "cam model scripts, cam model tip menu templates, cam model VIP client tracker, adult creator digital products, chaturbate earnings tracker",
  openGraph: {
    title: "Pretty Profitz Shop | Scripts, Kits & Tools for Cam Creators",
    description:
      "Roleplay scripts, VIP client trackers, tip menu templates, and earnings tools for cam models and adult content creators.",
    type: "website",
  },
};

export default function ShopPage() {
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
      </div>
    </div>
  );
}
