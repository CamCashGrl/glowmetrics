import ArticleLayout from '../../components/ArticleLayout'

const SLUG = 'how-to-upload-csv-to-camcash'
const URL = `https://www.camcashgrl.com/blog/${SLUG}`
const TITLE = 'How to Upload a CSV to CamCash (Step-by-Step SOP + Video)'
const DESC =
  'A step-by-step walkthrough for exporting your tip history, formatting it in Google Sheets, and uploading it to CamCash — plus the browser extension alternative.'

// Target keywords: how to upload csv to camcash, upload tip history csv, csv importer guide,
// export chaturbate csv, cam model csv upload tutorial, camcash csv import help

export const metadata = {
  title: TITLE,
  description: DESC,
  keywords: [
    'how to upload csv to camcash',
    'upload tip history csv',
    'csv importer guide for cam models',
    'export chaturbate csv',
    'cam model csv upload tutorial',
    'camcash csv import help',
    'how to import tips into camcash',
  ],
  alternates: { canonical: URL },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: URL,
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESC,
  },
}

const howToSchema = {
  '@type': 'HowTo',
  name: 'How to Upload a CSV to CamCash',
  description: DESC,
  step: [
    { '@type': 'HowToStep', name: 'Open CamCash and navigate to the relevant data range', text: 'Log in to CamCash, open the platform, and navigate to the historical range you want to pull data from.' },
    { '@type': 'HowToStep', name: 'Copy the data you want to upload', text: 'Select the rows you want to export. For a quick test, copy only a few rows first.' },
    { '@type': 'HowToStep', name: 'Paste the data into Google Sheets', text: 'Open Google Sheets, paste the data starting at cell A1, and rename the file.' },
    { '@type': 'HowToStep', name: 'Download the sheet as a CSV file', text: 'In Google Sheets, go to File → Download → Comma Separated Values (.csv).' },
    { '@type': 'HowToStep', name: 'Upload the CSV into CamCash', text: 'Return to CamCash, select Upload CSV, and choose the file you just downloaded.' },
    { '@type': 'HowToStep', name: 'Confirm the upload was successful', text: 'Verify the data appears correctly after upload.' },
  ],
}

const faqs = [
  { q: 'What file format does CamCash accept for tip history uploads?', a: 'CamCash accepts CSV files (.csv). Export your tip or earnings history from your platform, paste it into Google Sheets if needed, and download it as a Comma Separated Values (.csv) file before uploading.' },
  { q: 'Can I drag and drop my CSV file into CamCash?', a: 'No. Drag-and-drop is not supported for CSV uploads. Use the "Upload CSV" button in the Import CSV tab, which opens your file picker.' },
  { q: 'Do I need a subscription to upload CSVs from multiple platforms?', a: 'The free plan tracks one platform. Tracking multiple platforms (Chaturbate, BongaCams, MyFreeCams, and more) at once requires a subscription.' },
  { q: 'Is there a way to track tips without uploading a CSV?', a: "Yes. Go to the Live Mode page, click Start Stream, then Get Extension. The browser extension automatically tracks tips in real time, so you don't need to manually export and upload a CSV." },
  { q: 'Why isn’t my CSV loading correctly?', a: 'Select your platform from the dropdown before uploading, and make sure the file is exported correctly (for Chaturbate: Stats & Data → Token Stats; for BongaCams: Reports). CamCash auto-removes duplicate rows, so re-uploading the same file is safe.' },
]

const faqSchema = {
  '@type': 'FAQPage',
  mainEntity: faqs.map(f => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
}

const schema = { '@context': 'https://schema.org', '@graph': [howToSchema, faqSchema] }

const s = {
  h1:      { fontSize: '29px', fontWeight: 800, color: '#f1f5f9', lineHeight: 1.2, marginBottom: '14px', letterSpacing: '-0.02em' },
  intro:   { fontSize: '16px', lineHeight: 1.75, color: '#cbd5e1', marginBottom: '28px', paddingLeft: '14px', borderLeft: '3px solid #6366f1' },
  h2:      { fontSize: '20px', fontWeight: 700, color: '#e2e8f0', marginBottom: '10px', marginTop: '34px', letterSpacing: '-0.01em' },
  p:       { fontSize: '15px', lineHeight: 1.75, color: '#94a3b8', marginBottom: '14px' },
  ul:      { paddingLeft: '20px', marginBottom: '16px' },
  li:      { fontSize: '15px', lineHeight: 1.7, color: '#94a3b8', marginBottom: '6px' },
  meta:    { fontSize: '12px', color: '#475569', marginBottom: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap' },
  step:    { border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '16px 20px', marginBottom: '12px' },
  stepH:   { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' },
  stepNum: { fontSize: '12px', fontWeight: 700, color: '#fff', background: '#6366f1', borderRadius: '20px', padding: '2px 10px' },
  stepT:   { fontSize: '15px', fontWeight: 700, color: '#f1f5f9' },
  ts:      { fontSize: '12px', color: '#6366f1', textDecoration: 'none', fontWeight: 600 },
  note:    { background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '10px', padding: '16px 20px', marginBottom: '16px' },
  noteT:   { fontSize: '11px', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' },
  cta:     { background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.18)', borderRadius: '10px', padding: '22px 24px', margin: '32px 0', textAlign: 'center' },
  ctaT:    { fontSize: '17px', fontWeight: 700, color: '#f1f5f9', marginBottom: '6px' },
  ctaS:    { fontSize: '13px', color: '#64748b', marginBottom: '16px' },
  ctaBtn:  { display: 'inline-block', padding: '9px 22px', borderRadius: '7px', background: '#6366f1', color: 'white', fontWeight: 600, fontSize: '14px', textDecoration: 'none' },
  related: { marginTop: '32px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.06)' },
  relT:    { fontSize: '11px', color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' },
  relLinks:{ display: 'flex', flexDirection: 'column', gap: '6px' },
  relLink: { fontSize: '14px', color: '#6366f1', textDecoration: 'none' },
}

const STEPS = [
  { n: 1, t: 'Open the CamCash platform and navigate to the relevant data range', ts: 'https://loom.com/share/4d3ba7fd4457406398518ba587ae53c5?t=0', items: [
    'Log in to CamCash and open the platform.',
    'Navigate to the historical range you want to pull data from.',
    'Allow time for the page to load, especially if you are going back a long period of time.',
  ]},
  { n: 2, t: 'Copy the data you want to upload', ts: 'https://loom.com/share/4d3ba7fd4457406398518ba587ae53c5?t=14', items: [
    'Select the rows you want to export.',
    'For a quick test, you can copy only a few rows.',
    'Make sure the copied data includes the fields needed for the CSV upload.',
  ]},
  { n: 3, t: 'Paste the data into Google Sheets and organize the file', ts: 'https://loom.com/share/4d3ba7fd4457406398518ba587ae53c5?t=23', items: [
    'Open Google Sheets.',
    'Paste the copied data into the first row or starting cell.',
    'Rename the file so it is easy to find later.',
    'Confirm the data is formatted correctly before exporting.',
  ]},
  { n: 4, t: 'Download the sheet as a CSV file', ts: 'https://loom.com/share/4d3ba7fd4457406398518ba587ae53c5?t=50', items: [
    'In Google Sheets, go to Download.',
    'Choose CSV as the file format.',
    'Save the file to a location you can access easily for upload.',
  ]},
  { n: 5, t: 'Upload the CSV into CamCash', ts: 'https://loom.com/share/4d3ba7fd4457406398518ba587ae53c5?t=65', items: [
    'Return to CamCash.',
    'Select Upload CSV.',
    'Note: drag-and-drop is not available, so use the upload button/file picker.',
    'Choose the CSV file you just downloaded and complete the upload.',
  ]},
  { n: 6, t: 'Confirm the upload was successful', ts: 'https://loom.com/share/4d3ba7fd4457406398518ba587ae53c5?t=78', items: [
    'Verify that the data appears correctly after upload.',
    'If the upload is successful, the CSV data should now be tracked in the platform.',
    'Repeat the same process for other platforms as needed.',
  ]},
  { n: 7, t: 'Consider subscription requirements for multiple platforms', ts: 'https://loom.com/share/4d3ba7fd4457406398518ba587ae53c5?t=78', items: [
    'If you need to track multiple platforms, a subscription is required.',
    "Confirm your plan supports the number of platforms you want to manage before starting multiple uploads.",
  ]},
  { n: 8, t: 'Use the browser extension as an alternative to CSV uploads', ts: 'https://loom.com/share/4d3ba7fd4457406398518ba587ae53c5?t=111', items: [
    'If you do not want to use CSV files, go to the live mode page.',
    'Click Start Stream and then Get Extension.',
    'Download and install the extension.',
    'The extension automatically tracks tips, reducing the need for manual CSV uploads.',
  ]},
]

export default function HowToUploadCsvPage() {
  return (
    <ArticleLayout
      schema={schema}
      breadcrumb={[{ label: 'Blog', href: '/blog' }, { label: 'How to Upload a CSV to CamCash' }]}
    >
      <div style={s.meta}>
        <span>CamCash Team</span>
        <span>Updated July 2026</span>
        <span>4 min read</span>
      </div>
      <h1 style={s.h1}>SOP: Upload a CSV to CamCash</h1>
      <p style={s.intro}>
        This SOP explains how to prepare a CSV file from your data, upload it into CamCash, and verify the
        upload. It also covers an alternative for tracking tips automatically using the browser extension
        instead of CSV uploads.
      </p>

      {/* Embedded Loom video */}
      <div style={{ position: 'relative', paddingBottom: '52.5%', height: 0, borderRadius: 12, overflow: 'hidden', marginBottom: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
        <iframe
          src="https://www.loom.com/embed/4d3ba7fd4457406398518ba587ae53c5"
          frameBorder="0"
          allow="fullscreen"
          allowFullScreen
          title="SOP: Upload a CSV to CamCash"
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
        />
      </div>
      <p style={{ fontSize: 12, color: '#475569', marginBottom: 32 }}>
        <a href="https://loom.com/share/4d3ba7fd4457406398518ba587ae53c5" style={s.relLink}>Watch on Loom →</a>
      </p>

      <h2 style={s.h2}>Objective</h2>
      <p style={s.p}>
        Prepare a CSV file from your platform data, upload it into CamCash, and confirm the upload was
        successful. If you'd rather skip CSV uploads entirely, the browser extension tracks tips automatically.
      </p>
      <p style={s.p}>
        This is the full walkthrough for uploading tip history to CamCash — whether you're exporting a
        Chaturbate Token Stats CSV, a BongaCams earnings report, or any other platform export. If you get
        stuck partway through, the <a href="/dashboard" style={{ color: '#6366f1' }}>Import CSV tab</a>{' '}
        also has a "CSV help" shortcut that links back to this guide.
      </p>

      <h2 style={s.h2}>Key Steps</h2>
      {STEPS.map((step) => (
        <div key={step.n} style={s.step}>
          <div style={s.stepH}>
            <span style={s.stepNum}>{step.n}</span>
            <span style={s.stepT}>{step.t}</span>
          </div>
          <a href={step.ts} target="_blank" rel="noreferrer" style={s.ts}>Jump to this step in the video →</a>
          <ul style={{ ...s.ul, marginTop: 10 }}>
            {step.items.map((it, i) => (
              <li key={i} style={s.li}>{it}</li>
            ))}
          </ul>
        </div>
      ))}

      <h2 style={s.h2}>Cautionary Notes</h2>
      <div style={s.note}>
        <div style={s.noteT}>Watch out for</div>
        <ul style={{ ...s.ul, marginBottom: 0 }}>
          <li style={s.li}>Drag-and-drop is not supported for CSV uploads; use the upload button instead.</li>
          <li style={s.li}>Loading historical data may take time, especially when going back a long period.</li>
          <li style={s.li}>Tracking multiple platforms requires a subscription.</li>
          <li style={s.li}>Make sure the CSV is properly formatted before uploading to avoid errors.</li>
        </ul>
      </div>

      <h2 style={s.h2}>Tips for Efficiency</h2>
      <ul style={s.ul}>
        <li style={s.li}>Start with a small sample of rows to confirm the process works before uploading a full dataset.</li>
        <li style={s.li}>Rename your Google Sheet file clearly so it is easy to locate and re-use.</li>
        <li style={s.li}>Use the browser extension if you want automatic tracking and want to avoid repeated CSV uploads.</li>
        <li style={s.li}>Keep your source data organized in Google Sheets to make future exports faster.</li>
      </ul>

      <h2 style={s.h2}>Frequently Asked Questions</h2>
      {faqs.map((item, i) => (
        <div key={i} style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '16px 20px', marginBottom: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>{item.q}</div>
          <p style={{ ...s.p, marginBottom: 0 }}>{item.a}</p>
        </div>
      ))}

      <div style={s.cta}>
        <div style={s.ctaT}>Ready to upload your tip history?</div>
        <div style={s.ctaS}>Head to the Import CSV tab in your dashboard, or grab the extension for automatic tracking.</div>
        <a href="/dashboard" style={s.ctaBtn}>Go to Import CSV →</a>
      </div>

      <div style={s.related}>
        <div style={s.relT}>Related reading</div>
        <div style={s.relLinks}>
          <a href="/blog/how-to-track-cam-tips-automatically" style={s.relLink}>→ How to Track Cam Tips Automatically</a>
          <a href="/blog/best-cam-model-tools" style={s.relLink}>→ Best Cam Model Tools to Track Tips</a>
          <a href="/guides/cam-model-analytics" style={s.relLink}>→ Cam Model Analytics Dashboard</a>
        </div>
      </div>
    </ArticleLayout>
  )
}
