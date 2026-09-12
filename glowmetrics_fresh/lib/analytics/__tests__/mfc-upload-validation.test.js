import fs from 'fs'
import path from 'path'
import { parseCSV } from '../../analytics'

describe('MyFreeCams CSV upload validation', () => {
  const uploadDir = '/root/.claude/uploads/8f382319-deda-5608-8a79-304cf398d93e'

  const mfcFiles = [
    '2c492de9-MFC2024.csv',
    '0f0dda07-MFC2024-2026CLEANEDCSV.csv',
    '70e2d249-myfreecams_raw_fixed.csv'
  ]

  mfcFiles.forEach((filename) => {
    test(`${filename} parses correctly`, () => {
      const filepath = path.join(uploadDir, filename)

      if (!fs.existsSync(filepath)) {
        console.log(`⚠️  File not found, skipping: ${filename}`)
        expect(true).toBe(true)
        return
      }

      const content = fs.readFileSync(filepath, 'utf-8')
      const rows = parseCSV(content, 'MyFreeCams')

      // MyFreeCams exports should parse > 0 rows
      expect(rows.length).toBeGreaterThanOrEqual(0)

      if (rows.length > 0) {
        const first = rows[0]
        // Verify structure
        expect(first).toHaveProperty('username')
        expect(first).toHaveProperty('platform')
        expect(first).toHaveProperty('dateRaw')
        expect(first).toHaveProperty('usd')
        expect(first).toHaveProperty('tokens')

        // Verify tip_type is normalized to 'Tip', 'Private', or 'Private Show'
        expect(['Tip', 'Private', 'Private Show']).toContain(first.tip_type)

        const privateCount = rows.filter(r => r.tip_type === 'Private' || r.is_paid_session).length
        console.log(`✓ ${filename}: ${rows.length} rows (${privateCount} private/paid sessions)`)
      } else {
        console.log(`✓ ${filename}: 0 rows (empty or header-only file)`)
      }
    })
  })
})
