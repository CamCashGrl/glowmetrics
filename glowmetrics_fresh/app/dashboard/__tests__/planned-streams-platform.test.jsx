/**
 * planned_streams only accepts 'Chaturbate' | 'BongaCams' | 'MyFreeCams'.
 * Free users' default comes from profiles.primary_pro_platform, which is a
 * lowercase onboarding key — the insert must still send the exact name.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

const mockInserts = []
jest.mock('../../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: jest.fn(async (v) => { mockInserts.push(v); return { error: null } }),
      delete: () => ({ eq: async () => ({ error: null }) }),
    })),
  },
}))

import PlannedStreams from '../PlannedStreams'

function futureDate() {
  const d = new Date(Date.now() + 3 * 86400000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function saveWithDefault(defaultPlatform) {
  mockInserts.length = 0
  const { container } = render(<PlannedStreams userId="u1" defaultPlatform={defaultPlatform} />)
  fireEvent.change(container.querySelector('input[type="date"]'), { target: { value: futureDate() } })
  fireEvent.submit(container.querySelector('form'))
  await waitFor(() => expect(mockInserts).toHaveLength(1))
  return mockInserts[0]
}

describe('PlannedStreams default platform', () => {
  test.each([
    ['bongacams', 'BongaCams'],
    ['myfreecams', 'MyFreeCams'],
    ['chaturbate', 'Chaturbate'],
    ['BongaCams', 'BongaCams'],
  ])('default %s is saved as %s', async (given, expected) => {
    const row = await saveWithDefault(given)
    expect(row.platform).toBe(expected)
    expect(screen.getByTestId('plan-platform')).toHaveValue(expected)
  })

  test('unsupported or missing default falls back to Chaturbate', async () => {
    expect((await saveWithDefault('Stripchat')).platform).toBe('Chaturbate')
  })
})
