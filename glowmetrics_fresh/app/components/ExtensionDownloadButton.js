'use client'

export default function ExtensionDownloadButton({ style, label }) {
  return (
    <a
      href="/camcash-extension.zip"
      download
      style={style}
    >
      {label ?? '📥 Install Chrome Extension — Free'}
    </a>
  )
}
