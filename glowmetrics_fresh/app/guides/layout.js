import SiteFooter from '../components/SiteFooter'
import FreeToolsBanner from '../components/FreeToolsBanner'

export default function GuidesLayout({ children }) {
  return (
    <>
      {children}
      <FreeToolsBanner />
      <SiteFooter />
    </>
  )
}
