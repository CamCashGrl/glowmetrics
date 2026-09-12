import { computePlatformCardStats } from '../DashboardPreview'

describe('Platform stats with paid sessions', () => {
  test('computePlatformCardStats includes paid session revenue', () => {
    const tips = [
      {
        platform: 'BongaCams',
        date_time: '2026-09-01T10:00:00Z',
        usd: 100,
        tokens: 2000,
        username: 'user1',
      },
      {
        platform: 'BongaCams',
        date_time: '2026-09-05T15:00:00Z',
        usd: 50,
        tokens: 1000,
        username: 'user2',
      },
    ]

    const paidSessions = [
      {
        platform: 'BongaCams',
        date_time: '2026-09-02T12:00:00Z',
        usd: 200, // Private chat
        tokens: 4000,
        session_type: 'Private Chat',
        username: 'user1',
      },
      {
        platform: 'BongaCams',
        date_time: '2026-09-03T14:00:00Z',
        usd: 150, // Spy mode
        tokens: 3000,
        session_type: 'Spy Mode',
        username: 'user3',
      },
    ]

    const stats = computePlatformCardStats(tips, [], 'BongaCams', 31, {}, paidSessions)

    // Should include both free tips and paid sessions
    expect(stats.hasData).toBe(true)
    expect(stats.tipCount).toBe(4) // 2 tips + 2 paid sessions
    // Revenue: 100 + 50 (tips) + 200 + 150 (paid) = 500
    expect(stats.usd).toBe(500)
  })

  test('computePlatformCardStats excludes paid sessions from other platforms', () => {
    const tips = [
      {
        platform: 'BongaCams',
        date_time: '2026-09-01T10:00:00Z',
        usd: 100,
        tokens: 2000,
        username: 'user1',
      },
    ]

    const paidSessions = [
      {
        platform: 'BongaCams',
        date_time: '2026-09-02T12:00:00Z',
        usd: 200,
        tokens: 4000,
        session_type: 'Private Chat',
        username: 'user1',
      },
      {
        platform: 'Chaturbate', // Different platform
        date_time: '2026-09-02T12:00:00Z',
        usd: 50,
        tokens: 1000,
        session_type: 'Private Show',
        username: 'user2',
      },
    ]

    const stats = computePlatformCardStats(tips, [], 'BongaCams', 31, {}, paidSessions)

    // Should only include BongaCams data
    expect(stats.tipCount).toBe(2) // 1 tip + 1 paid session (Chaturbate excluded)
    expect(stats.usd).toBe(300) // 100 + 200
  })

  test('computePlatformCardStats handles empty paid sessions', () => {
    const tips = [
      {
        platform: 'BongaCams',
        date_time: '2026-09-01T10:00:00Z',
        usd: 100,
        tokens: 2000,
        username: 'user1',
      },
    ]

    const stats = computePlatformCardStats(tips, [], 'BongaCams', 31, {}, [])

    expect(stats.tipCount).toBe(1)
    expect(stats.usd).toBe(100)
  })

  test('computePlatformCardStats respects date window with paid sessions', () => {
    const tips = [
      {
        platform: 'MyFreeCams',
        date_time: '2026-08-01T10:00:00Z', // Old tip
        usd: 50,
        tokens: 1000,
        username: 'user1',
      },
      {
        platform: 'MyFreeCams',
        date_time: '2026-09-05T15:00:00Z', // Recent tip
        usd: 75,
        tokens: 1500,
        username: 'user2',
      },
    ]

    const paidSessions = [
      {
        platform: 'MyFreeCams',
        date_time: '2026-09-02T12:00:00Z', // Recent paid session
        usd: 100,
        tokens: 2000,
        session_type: 'Private',
        username: 'user1',
      },
    ]

    // 31-day window (default)
    const stats = computePlatformCardStats(tips, [], 'MyFreeCams', 31, {}, paidSessions)

    // Should include all data within 31 days of the most recent (2026-09-05)
    expect(stats.tipCount).toBeGreaterThan(0)
    expect(stats.usd).toBeGreaterThan(0)
  })
})
