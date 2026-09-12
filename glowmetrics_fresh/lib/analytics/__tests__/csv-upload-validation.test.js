import fs from 'fs'
import path from 'path'
import { parseCSV } from '../../analytics'

describe('CSV upload validation', () => {
  const uploadDir = '/root/.claude/uploads/8f382319-deda-5608-8a79-304cf398d93e'

  const csvFiles = [
    'f870e69d-bongacams2024-2025freechat.csv',
    'e638abb3-bongacamsfreechat2023-2026.csv',
    '6ad0b899-bongacamsfreechat2024-2026.csv',
    'ef063b24-chaturbatecsv2026.csv',
    'c9158578-chaturbate-csv-alltime.csv'
  ]

  csvFiles.forEach((filename) => {
    test(`${filename} parses with > 0 rows`, () => {
      const filepath = path.join(uploadDir, filename)

      // Skip test if file doesn't exist (e.g., in a different environment)
      if (!fs.existsSync(filepath)) {
        console.log(`⚠️  File not found, skipping: ${filename}`)
        expect(true).toBe(true)
        return
      }

      const content = fs.readFileSync(filepath, 'utf-8')
      const rows = parseCSV(content)

      // Critical: After the fix, all well-formed CSVs should parse > 0 rows
      // Before the fix, the delimiter bug caused all of them to return 0 rows
      expect(rows.length).toBeGreaterThan(0)

      if (rows.length > 0) {
        const first = rows[0]
        // Verify structure
        expect(first).toHaveProperty('username')
        expect(first).toHaveProperty('platform')
        expect(first).toHaveProperty('dateRaw')
        expect(first).toHaveProperty('usd')
        expect(first).toHaveProperty('tokens')

        // Validate data
        expect(typeof first.username).toBe('string')
        expect(first.username.length).toBeGreaterThan(0)
        expect(typeof first.usd).toBe('number')
        expect(first.usd).toBeGreaterThanOrEqual(0)
      }

      console.log(`✓ ${filename}: ${rows.length} rows parsed`)
    })
  })
})
