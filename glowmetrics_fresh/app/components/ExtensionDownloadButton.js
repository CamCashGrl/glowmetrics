'use client'

import { track } from '../../lib/track'

export default function ExtensionDownloadButton({ style, label }) {
  return (
    <a
      href="/camcash-extension.zip"
      download
      style={style}
      onClick={() => {
        track('extension_download_clicked', { source_page: window.location.pathname })
      }}
    >
      {label ?? '📥 Install Chrome Extension — Free'}
    </a>
  )
}
