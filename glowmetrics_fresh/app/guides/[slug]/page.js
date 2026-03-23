import { notFound } from "next/navigation"

const platforms = ["chaturbate", "myfreecams", "camsoda", "bongacams"]

const topics = {
  "best-time": "Best Time to Stream",
  "more-tips": "How to Get More Tips",
  "top-tippers": "How to Find Top Tippers",
  "increase-income": "How to Increase Cam Income",
}

export function generateStaticParams() {
  const paths = []

  platforms.forEach(platform => {
    Object.keys(topics).forEach(topic => {
      paths.push({
        slug: `${topic}-${platform}`
      })
    })
  })

  return paths
}

export default function Page({ params }) {
  const { slug } = params

  const match = slug.match(/(.*)-(chaturbate|myfreecams|camsoda|bongacams)/)
  if (!match) return notFound()

  const topicKey = match[1]
  const platform = match[2]

  const title = `${topics[topicKey]} on ${platform}`

  return (
    <div style={{padding:"40px", maxWidth:800, margin:"0 auto"}}>
      <h1>{title}</h1>

      <p>
        If you're streaming on {platform}, your data already shows what makes you money.
      </p>

      <p>
        Most models guess when to stream and who to focus on. 
        The ones making the most money use data to decide.
      </p>

      <h2>Why This Matters</h2>

      <p>
        By understanding your top tippers and peak hours,
        you can dramatically increase your income.
      </p>

      <h2>Use Your Data</h2>

      <p>
        Upload your CSV and instantly see your best fans,
        best times, and what actions to take next.
      </p>

      <a href="/login" style={{color:"cyan"}}>
        Try the analytics tool →
      </a>
    </div>
  )
}
