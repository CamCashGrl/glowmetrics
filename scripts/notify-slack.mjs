#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import https from 'https'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')

// Get webhook URL from environment
const WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL

if (!WEBHOOK_URL) {
  console.error('❌ SLACK_WEBHOOK_URL environment variable not set')
  console.error('Set it with: export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."')
  process.exit(1)
}

const status = process.argv[2] || 'unknown'
const message = process.argv[3] || 'Test notification'

const timestamp = new Date().toLocaleString()
const gitBranch = process.env.GIT_BRANCH || 'unknown'

const payload = {
  text: `CamCash Test ${status === 'FAIL' ? '❌ Failed' : '✅ Passed'}`,
  blocks: [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: status === 'FAIL' ? '🚨 CamCash Tests Failed' : '✅ CamCash Tests Passed',
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Status:*\n${status === 'FAIL' ? '❌ Failed' : '✅ Passed'}`,
        },
        {
          type: 'mrkdwn',
          text: `*Branch:*\n${gitBranch}`,
        },
        {
          type: 'mrkdwn',
          text: `*Time:*\n${timestamp}`,
        },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Message:*\n${message}`,
      },
    },
  ],
}

if (status === 'FAIL') {
  payload.blocks[0].text.text = '🚨 CamCash Tests Failed'
  payload.blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'View Logs',
        },
        url: 'file://' + path.join(rootDir, 'logs/tests/'),
        style: 'danger',
      },
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'View Report',
        },
        url: 'file://' + path.join(rootDir, 'glowmetrics_fresh/test-results/report.html'),
      },
    ],
  })
}

// Send to Slack
const postData = JSON.stringify(payload)

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
  },
}

console.log(`📤 Sending Slack notification (${status})...`)

https
  .request(WEBHOOK_URL, options, (res) => {
    let data = ''

    res.on('data', (chunk) => {
      data += chunk
    })

    res.on('end', () => {
      if (res.statusCode === 200) {
        console.log('✅ Slack notification sent successfully')
        process.exit(0)
      } else {
        console.error(`❌ Slack error: ${res.statusCode}`)
        console.error(data)
        process.exit(1)
      }
    })
  })
  .on('error', (err) => {
    console.error('❌ Error sending notification:', err.message)
    process.exit(1)
  })
  .write(postData)
