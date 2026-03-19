import { getUserAnalytics } from "@/lib/analytics";

export default async function Dashboard() {
  const data = await getUserAnalytics();

  return (
    <div className="min-h-screen bg-black text-white p-6">

      {/* HEADER */}
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card title="Total Revenue" value={`$${data.lifetimeUSD}`} />
        <Card title="Avg / Day" value={`$${data.avgPerDay}`} />
        <Card title="Fans" value={data.uniqueTippers} />
        <Card title="Whales" value={data.whaleCount} />
      </div>

      {/* MAIN GRID */}
      <div className="grid md:grid-cols-2 gap-6">

        {/* WHALE ALERTS */}
        <div className="bg-zinc-900 p-5 rounded-2xl shadow-lg border border-zinc-800">
          <h2 className="text-xl font-semibold mb-4">🚨 Whale Alerts</h2>

          {data.dormantWhales?.length > 0 ? (
            data.dormantWhales.map((fan, i) => (
              <div key={i} className="mb-3 p-3 bg-zinc-800 rounded-lg">
                <p className="text-sm">
                  {fan.username} inactive {fan.daysInactive} days
                </p>
                <button className="text-pink-400 text-sm mt-1 hover:underline">
                  Re-engage
                </button>
              </div>
            ))
          ) : (
            <p className="text-gray-400 text-sm">No alerts right now</p>
          )}
        </div>

        {/* SMART INSIGHTS */}
        <div className="bg-zinc-900 p-5 rounded-2xl shadow-lg border border-zinc-800">
          <h2 className="text-xl font-semibold mb-4">💡 Smart Insights</h2>

          {data.insights?.map((insight, i) => (
            <div key={i} className="mb-3 p-3 bg-zinc-800 rounded-lg">
              <p className="text-sm">{insight}</p>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}


/* CARD COMPONENT */
function Card({ title, value }) {
  return (
    <div className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800 shadow-md hover:scale-[1.02] transition">
      <p className="text-sm text-gray-400">{title}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
