import { PRODUCTS } from "../../lib/shop-products";
import { ProductCard } from "./ProductCard";

export const metadata = {
  title: 'Pretty Profitz Shop — Premium Cam Model Scripts, Templates & Tools',
  description: 'Premium cam model scripts, templates, and productivity tools for Chaturbate, BongaCams, MyFreeCams creators. Roleplay bundles, tip menus, client trackers, and branding kits to help you earn more.',
  alternates: { canonical: 'https://www.camcashgrl.com/shop' },
  openGraph: {
    title: 'Pretty Profitz Shop — Cam Model Scripts & Tools',
    description: 'Premium templates and tools for cam creators. Roleplay scripts, tip menu ideas, client trackers, branding kits.',
    url: 'https://www.camcashgrl.com/shop',
    siteName: 'CamCash',
    type: 'website',
    images: [{ url: 'https://www.camcashgrl.com/og-image.png', width: 1200, height: 630, alt: 'Pretty Profitz Shop' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pretty Profitz Shop — Cam Model Scripts & Tools',
    description: 'Premium cam creator tools: roleplay scripts, tip menus, client trackers, templates.',
    images: ['https://www.camcashgrl.com/og-image.png'],
  },
};

export default function ShopPage() {
  // Collection schema for all products
  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    'name': 'Pretty Profitz Shop - Cam Model Scripts & Tools',
    'description': 'Premium templates and tools for cam creators on Chaturbate, BongaCams, MyFreeCams, CamSoda, and Stripchat.',
    'url': 'https://www.camcashgrl.com/shop',
    'mainEntity': {
      '@type': 'ItemList',
      'name': 'Cam Model Products',
      'itemListElement': PRODUCTS.map((product, index) => ({
        '@type': 'ListItem',
        'position': index + 1,
        'name': product.shortTitle,
        'url': `https://www.camcashgrl.com/shop/${product.slug}`,
        'image': `https://www.camcashgrl.com${product.coverImage}`,
      }))
    }
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }} />
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
    </>
  );
}
