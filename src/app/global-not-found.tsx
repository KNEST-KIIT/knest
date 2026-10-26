import SiteDocument from '@/components/layout/site-document'
import NotFoundPage from '@/components/layout/not-found-page'
export { metadata } from '@/components/layout/not-found-page'

export default function GlobalNotFound() {
  return (
    <SiteDocument>
      <main id="main">
        <NotFoundPage />
      </main>
    </SiteDocument>
  )
}
