import { notFound } from 'next/navigation'
import { T } from '../components/theme'
import StoreTopBar from '../components/StoreTopBar'
import ProductDetails from '../components/ProductDetails'
import SiteFooter from '../../components/SiteFooter'
import { getAllSlugs, getProductBySlug, getRelatedProducts } from '../../../lib/store/products'

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({ params }) {
  const product = getProductBySlug(params.slug)
  if (!product) {
    return { title: 'Product Not Found | CamCash Store' }
  }
  return {
    title: `${product.title} | CamCash Store`,
    description: product.shortDescription,
    alternates: {
      canonical: `https://www.camcashgrl.com/store/${product.slug}`,
    },
  }
}

export default function ProductPage({ params }) {
  const product = getProductBySlug(params.slug)
  if (!product) notFound()

  const related = getRelatedProducts(product)

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text }}>
      <StoreTopBar />
      <ProductDetails product={product} related={related} />
      <SiteFooter />
    </div>
  )
}
