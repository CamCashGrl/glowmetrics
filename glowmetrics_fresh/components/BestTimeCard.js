"use client"

export default function BestTimeCard() {
  const now = new Date()
  const hour = now.getHours()

  let suggestion = "Slow hours — focus on content creation."

  if (hour >= 18 && hour <= 23) {
    suggestion = "🔥 Peak hours — go live now"
  } else if (hour >= 12 && hour < 18) {
    suggestion = "Good traffic — post content"
  }

  return (
    <div className="p-4 bg-[#1a2235] rounded-xl mb-4">
      <h2 className="text-lg font-bold mb-2">Best Time Insight</h2>
      <p className="text-sm text-gray-400">{suggestion}</p>
    </div>
  )
}
