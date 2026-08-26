import { PRODUCTS } from "../../lib/shop-products";
import { SHOP_SEO, SHOP_FAQS } from "../../lib/shop-seo";
import ShopClient from "./ShopClient";

const SITE_URL = "https://www.camcashgrl.com";
const SHOP_URL = `${SITE_URL}/shop`;

export const metadata = {
  title: "Pretty Profitz Shop | Cam Model Scripts, Trackers & Templates",
  description:
    "Digital products for cam creators: VIP client trackers, Chaturbate earnings workbooks, tip menu and room title packs, roleplay scripts, dice and wheel games.",
  keywords:
    "cam model scripts, cam model tracker, tip menu template, cam room titles, VIP client tracker, cam model workbook, adult creator digital downloads",
  alternates: { canonical: SHOP_URL },
  openGraph: {
    title: "Pretty Profitz Shop | Scripts, Kits & Trackers for Cam Creators",
    description:
      "Roleplay bundles, tip menus, trackers and templates — made by a creator, for creators. Instant digital downloads.",
    url: SHOP_URL,
    siteName: "CamCash",
    images: [PRODUCTS[0].coverImage],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pretty Profitz Shop | Scripts, Kits & Trackers for Cam Creators",
    description:
      "Roleplay bundles, tip menus, trackers and templates — made by a creator, for creators.",
    images: [PRODUCTS[0].coverImage],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "CollectionPage",
      "@id": `${SHOP_URL}#page`,
      name: "Pretty Profitz Shop",
      url: SHOP_URL,
      description: metadata.description,
    },
    {
      "@type": "ItemList",
      "@id": `${SHOP_URL}#products`,
      name: "Pretty Profitz digital products",
      numberOfItems: PRODUCTS.length,
      itemListElement: PRODUCTS.map((product, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "Product",
          name: product.title,
          url: `${SHOP_URL}/${product.slug}`,
          image: product.coverImage,
          description:
            SHOP_SEO[product.slug]?.metaDescription ||
            product.description.slice(0, 200),
          brand: { "@type": "Brand", name: "Pretty Profitz" },
          offers: {
            "@type": "Offer",
            price: product.price.replace(/[^0-9.]/g, ""),
            priceCurrency: "USD",
            availability: "https://schema.org/InStock",
            url: product.etsyUrl,
          },
        },
      })),
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Shop", item: SHOP_URL },
      ],
    },
    {
      "@type": "FAQPage",
      "@id": `${SHOP_URL}#faq`,
      mainEntity: SHOP_FAQS.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ],
};

export default function ShopPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ShopClient />
    </>
  );
}
