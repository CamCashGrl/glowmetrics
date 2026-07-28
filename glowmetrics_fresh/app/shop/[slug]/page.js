import { notFound } from "next/navigation";
import { PRODUCTS, getProductBySlug } from "../../../lib/shop-products";
import ProductDetailClient from "./ProductDetailClient";

// Pre-render all 15 product pages at build time for SEO
export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }) {
  const product = getProductBySlug(params.slug);
  if (!product) return {};

  const metaDescription = product.description.slice(0, 155).trim() + "...";

  return {
    title: `${product.title} | Pretty Profitz`,
    description: metaDescription,
    keywords: product.seoKeywords,
    openGraph: {
      title: product.title,
      description: metaDescription,
      images: [product.coverImage],
      type: "website",
    },
  };
}

export default function ProductDetailPage({ params }) {
  const product = getProductBySlug(params.slug);
  if (!product) notFound();

  return <ProductDetailClient product={product} />;
}
