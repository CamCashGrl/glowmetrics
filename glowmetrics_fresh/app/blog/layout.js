import SiteFooter from '../components/SiteFooter'
import FreeToolsBanner from '../components/FreeToolsBanner'

export default function BlogLayout({ children }) {
  return (
    <>
      {children}
      <FreeToolsBanner />
      <SiteFooter />
    </>
  )
}
