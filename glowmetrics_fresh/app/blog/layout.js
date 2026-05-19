import SiteFooter from '../components/SiteFooter'

export default function BlogLayout({ children }) {
  return (
    <>
      {children}
      <SiteFooter />
    </>
  )
}
