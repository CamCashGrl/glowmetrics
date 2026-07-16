export const metadata = {
  title: 'Collaboration Details',
  robots: { index: false, follow: false },
}

import PostDetailClient from './PostDetailClient'

export default function CollabPostPage({ params }) {
  return <PostDetailClient postId={params.postId} />
}
