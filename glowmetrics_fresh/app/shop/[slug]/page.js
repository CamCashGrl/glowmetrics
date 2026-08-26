import { notFound } from "next/navigation";
import { PRODUCTS, getProductBySlug } from "../../../lib/shop-products";
import { getSeo } from "../../../lib/shop-seo";
import ProductDetailClient from "./ProductDetailClient";

const SITE_URL = "https://www.camcashgrl.com";

// Pre-render all product pages at build time for SEO
export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }) {
  const product = getProductBySlug(params.slug);
  if (!product) return {};

  const seo = getSeo(product.slug);
  // Hand-written meta description where we have one; the truncated Etsy copy
  // is only a fallback for a product added before its SEO entry exists.
  const metaDescription =
    seo?.metaDescription || product.description.slice(0, 155).trim() + "...";
  const url = `${SITE_URL}/shop/${product.slug}`;

  return {
    title: `${product.title} | Pretty Profitz`,
    description: metaDescription,
    keywords: product.seoKeywords,
    alternates: { canonical: url },
    openGraph: {
      title: product.title,
      description: metaDescription,
      url,
      siteName: "CamCash",
      images: [product.coverImage],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: product.title,
      description: metaDescription,
      images: [product.coverImage],
    },
  };
}

function buildJsonLd(product, seo) {
  const url = `${SITE_URL}/shop/${product.slug}`;
  const priceValue = product.price.replace(/[^0-9.]/g, "");

  const graph = [
    {
      "@type": "Product",
      "@id": `${url}#product`,
      name: product.title,
      description: seo?.metaDescription || product.description.slice(0, 300),
      image: [product.coverImage, ...product.galleryImages].slice(0, 6),
      sku: product.slug,
      category: "Digital Download",
      brand: { "@type": "Brand", name: "Pretty Profitz" },
      url,
      offers: {
        "@type": "Offer",
        price: priceValue,
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        itemCondition: "https://schema.org/NewCondition",
        url: product.etsyUrl,
        seller: { "@type": "Organization", name: "Pretty Profitz" },
      },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Shop", item: `${SITE_URL}/shop` },
        { "@type": "ListItem", position: 3, name: product.shortTitle, item: url },
      ],
    },
  ];

  if (seo?.faqs?.length) {
    graph.push({
      "@type": "FAQPage",
      "@id": `${url}#faq`,
      mainEntity: seo.faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });
  }

  return { "@context": "https://schema.org", "@graph": graph };
}

export default function ProductDetailPage({ params }) {
  const product = getProductBySlug(params.slug);
  if (!product) notFound();

  const seo = getSeo(product.slug);
  const related = (seo?.related || [])
    .map((slug) => getProductBySlug(slug))
    .filter(Boolean);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd(product, seo)) }}
      />
      <ProductDetailClient product={product} seo={seo} related={related} />
    </>
  );
}
