export const metadata = {
  title: 'Creator Collab Board',
  description: 'Find verified CamCash creators for cam battles, duo streams, content collabs, cross-promotion, and more.',
  robots: { index: false, follow: false },
}

import CollabBoardClient from './CollabBoardClient'

export default function CollabsPage() {
  return <CollabBoardClient />
}
