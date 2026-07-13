// Client-side CSV export for user tip data. No server round-trip — builds
// the file in-browser from rows already loaded into the dashboard.

const COLUMNS = [
  { key: "date_time", header: "Date" },
  { key: "platform",  header: "Platform" },
  { key: "username",  header: "Username" },
  { key: "tip_type",  header: "Type" },
  { key: "tokens",    header: "Tokens" },
  { key: "usd",       header: "Amount (USD)" },
  { key: "tip_note",  header: "Note" },
]

function escapeCSVField(value) {
  const str = value == null ? "" : String(value)
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

export function tipsToCSV(tips) {
  const header = COLUMNS.map(c => c.header).join(",")
  const rows = tips.map(tip =>
    COLUMNS.map(c => escapeCSVField(tip[c.key])).join(",")
  )
  return [header, ...rows].join("\n")
}

export function downloadCSV(filename, csvString) {
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function exportTipsAsCSV(tips, filename = `camcash-tips-${new Date().toISOString().split("T")[0]}.csv`) {
  downloadCSV(filename, tipsToCSV(tips))
}
