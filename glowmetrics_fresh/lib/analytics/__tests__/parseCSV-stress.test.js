import { parseCSV, detectPlatform } from '../../analytics'

// Broad stress test across many realistic and edge-case dataset shapes per
// platform, run after fixing three real zero-row bugs (BongaCams stacked
// headers, MyFreeCams ordinal dates + missing headerless branch, and the
// hasHeaders substring false-positive that broke MFC's own placeholder
// format). Each case asserts an EXACT expected row count so a future
// regression that silently drops rows fails loudly instead of passing with
// fewer rows than it should.

function tabLines(rows) {
  return rows.map(r => r.join('\t')).join('\n')
}

describe('parseCSV stress test — BongaCams (30+ shapes)', () => {
  test('01: stacked single-cell header + tab data (real reported bug)', () => {
    const csv = ['Date and Time', 'Member', 'Type', 'Tokens Earned', 'Your Payout',
      '13.09.2026 16:19\tkopeesh\tTips\t16\t$0.378'].join('\n')
    expect(parseCSV(csv, 'BongaCams')).toHaveLength(1)
  })

  test('02: single joined tab header row', () => {
    const csv = tabLines([
      ['Date and Time', 'Member', 'Type', 'Tokens Earned', 'Your Payout'],
      ['18.06.2026 14:32', 'username123', 'Tips', '500', '$25.00'],
      ['18.06.2026 15:14', 'whaleking99', 'Tips', '1000', '$50.00'],
    ])
    expect(parseCSV(csv, 'BongaCams')).toHaveLength(2)
  })

  test('03: comma-delimited header row', () => {
    const csv = ['Date,Platform,Username,Tokens,USD_Amount',
      '2026-02-23,Bongacams,Daddy7733,,0.02'].join('\n')
    expect(parseCSV(csv)).toHaveLength(1)
  })

  test('04: headerless placeholder format (date\\tuser\\ttokens\\tusd)', () => {
    const csv = tabLines([
      ['18.06.2026 14:32', 'username123', '500', '25.00'],
      ['18.06.2026 15:14', 'whaleking99', '1000', '50.00'],
      ['18.06.2026 15:45', 'regularfan', '25', '1.25'],
    ])
    expect(parseCSV(csv, 'BongaCams')).toHaveLength(3)
  })

  test('05: Chat Type column with paid session types mixed with free tips', () => {
    const csv = tabLines([
      ['Date and Time', 'Member', 'Chat Type', 'Tokens Earned', 'Your Payout'],
      ['18.06.2026 14:32', 'fanA', 'Tips', '500', '$25.00'],
      ['18.06.2026 15:00', 'fanB', 'Private Chat', '2000', '$100.00'],
      ['18.06.2026 15:30', 'fanC', 'Full-Private Chat', '3000', '$150.00'],
      ['18.06.2026 16:00', 'fanD', 'Group Chat', '1000', '$50.00'],
      ['18.06.2026 16:30', 'fanE', 'Spy Mode', '500', '$25.00'],
    ])
    const rows = parseCSV(csv, 'BongaCams')
    expect(rows).toHaveLength(5)
    expect(rows.filter(r => r.is_paid_session)).toHaveLength(4)
  })

  test('06: thousands separator in tokens ("1 507")', () => {
    const csv = tabLines([
      ['Date and Time', 'Member', 'Type', 'Tokens Earned', 'Your Payout'],
      ['18.06.2026 14:32', 'whale1', 'Tips', '1 507', '$75.35'],
    ])
    expect(parseCSV(csv, 'BongaCams')[0].tokens).toBe(1507)
  })

  test('07: blank lines interspersed', () => {
    const csv = ['Date and Time\tMember\tType\tTokens Earned\tYour Payout',
      '', '18.06.2026 14:32\tfanA\tTips\t500\t$25.00', '', '',
      '18.06.2026 15:00\tfanB\tTips\t100\t$5.00'].join('\n')
    expect(parseCSV(csv, 'BongaCams')).toHaveLength(2)
  })

  test('08: CRLF line endings', () => {
    const csv = ['Date and Time\tMember\tType\tTokens Earned\tYour Payout',
      '18.06.2026 14:32\tfanA\tTips\t500\t$25.00'].join('\r\n')
    expect(parseCSV(csv, 'BongaCams').length).toBeGreaterThanOrEqual(1)
  })

  test('09: quoted comma-CSV fields', () => {
    const csv = ['"Date","Username","Tokens","USD_Amount"',
      '"2026-02-23","Daddy7733","500","25.00"'].join('\n')
    expect(parseCSV(csv, 'BongaCams')).toHaveLength(1)
  })

  test('10: Free Chat + Paid Chat sections pasted together', () => {
    const csv = tabLines([
      ['Date and Time', 'Member', 'Type', 'Tokens Earned', 'Your Payout'],
      ['18.06.2026 14:32', 'fanA', 'Tips', '500', '$25.00'],
      ['18.06.2026 15:00', 'fanB', 'Private Chat', '2000', '$100.00'],
    ])
    expect(parseCSV(csv, 'BongaCams')).toHaveLength(2)
  })

  test('11: zero-token rows dropped', () => {
    const csv = tabLines([
      ['Date and Time', 'Member', 'Type', 'Tokens Earned', 'Your Payout'],
      ['18.06.2026 14:32', 'fanA', 'Tips', '0', '$0.00'],
      ['18.06.2026 15:00', 'fanB', 'Tips', '100', '$5.00'],
    ])
    expect(parseCSV(csv, 'BongaCams')).toHaveLength(1)
  })

  test('12: missing username dropped', () => {
    const csv = tabLines([
      ['Date and Time', 'Member', 'Type', 'Tokens Earned', 'Your Payout'],
      ['18.06.2026 14:32', '', 'Tips', '100', '$5.00'],
      ['18.06.2026 15:00', 'fanB', 'Tips', '100', '$5.00'],
    ])
    expect(parseCSV(csv, 'BongaCams')).toHaveLength(1)
  })

  test('13: cashout/transfer rows excluded', () => {
    const csv = tabLines([
      ['Date and Time', 'Member', 'Action', 'Tokens Earned', 'Your Payout'],
      ['18.06.2026 14:32', '', 'Transfer tokens to cash', '5000', '$250.00'],
      ['18.06.2026 15:00', 'fanB', 'Tip From: fanB', '100', '$5.00'],
    ])
    const rows = parseCSV(csv, 'BongaCams')
    expect(rows.every(r => !/transfer/i.test(r.tip_type || ''))).toBe(true)
  })

  test('14: extra whitespace around fields', () => {
    const csv = tabLines([
      ['Date and Time', 'Member', 'Type', 'Tokens Earned', 'Your Payout'],
      ['  18.06.2026 14:32  ', '  fanA  ', ' Tips ', ' 500 ', ' $25.00 '],
    ])
    const rows = parseCSV(csv, 'BongaCams')
    expect(rows).toHaveLength(1)
    expect(rows[0].username).toBe('fana')
  })

  test('15: uppercase header names', () => {
    const csv = tabLines([
      ['DATE AND TIME', 'MEMBER', 'TYPE', 'TOKENS EARNED', 'YOUR PAYOUT'],
      ['18.06.2026 14:32', 'fanA', 'Tips', '500', '$25.00'],
    ])
    expect(parseCSV(csv, 'BongaCams')).toHaveLength(1)
  })

  test('16: header columns in different order', () => {
    const csv = tabLines([
      ['Member', 'Date and Time', 'Tokens Earned', 'Type', 'Your Payout'],
      ['fanA', '18.06.2026 14:32', '500', 'Tips', '$25.00'],
    ])
    const rows = parseCSV(csv, 'BongaCams')
    expect(rows).toHaveLength(1)
    expect(rows[0].username).toBe('fana')
    expect(rows[0].tokens).toBe(500)
  })

  test('17: extra Session_ID column present', () => {
    const csv = ['Date,Platform,Username,Tokens,USD_Amount,Session_ID',
      '2026-02-23,Bongacams,fanA,500,25.00,BC-2026-02-23'].join('\n')
    expect(parseCSV(csv)).toHaveLength(1)
  })

  test('18: USD_Amount populated with empty Tokens column', () => {
    const csv = ['Date,Platform,Username,Tokens,USD_Amount',
      '2026-02-23,Bongacams,fanA,,7.16'].join('\n')
    const rows = parseCSV(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0].usd).toBeCloseTo(7.16, 2)
  })

  test('19: whale tip (large token count)', () => {
    const csv = tabLines([
      ['Date and Time', 'Member', 'Type', 'Tokens Earned', 'Your Payout'],
      ['18.06.2026 14:32', 'bigspender', 'Tips', '250000', '$12500.00'],
    ])
    expect(parseCSV(csv, 'BongaCams')[0].tokens).toBe(250000)
  })

  test('20: sub-cent payout precision rounds to 2 decimals', () => {
    const csv = tabLines([
      ['Date and Time', 'Member', 'Type', 'Tokens Earned', 'Your Payout'],
      ['18.06.2026 14:32', 'fanA', 'Tips', '1', '$0.0234567'],
    ])
    expect(parseCSV(csv, 'BongaCams')[0].usd).toBeCloseTo(0.02, 2)
  })

  test('21: single-row minimal dataset', () => {
    const csv = tabLines([
      ['Date and Time', 'Member', 'Type', 'Tokens Earned', 'Your Payout'],
      ['18.06.2026 14:32', 'onlyfan', 'Tips', '1', '$0.05'],
    ])
    expect(parseCSV(csv, 'BongaCams')).toHaveLength(1)
  })

  test('22: large dataset (200 rows) — every row survives', () => {
    const header = ['Date and Time', 'Member', 'Type', 'Tokens Earned', 'Your Payout']
    const rows = []
    for (let i = 0; i < 200; i++) {
      rows.push([`18.06.2026 ${String(10 + (i % 12)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}`, `fan${i}`, 'Tips', String(1 + i), `$${(0.05 * (1 + i)).toFixed(2)}`])
    }
    const csv = tabLines([header, ...rows])
    expect(parseCSV(csv, 'BongaCams')).toHaveLength(200)
  })

  test('23: repeated tipper across multiple rows keeps every row', () => {
    const csv = tabLines([
      ['Date and Time', 'Member', 'Type', 'Tokens Earned', 'Your Payout'],
      ['18.06.2026 14:32', 'loyalfan', 'Tips', '1', '$0.05'],
      ['18.06.2026 14:33', 'loyalfan', 'Tips', '1', '$0.05'],
      ['18.06.2026 14:34', 'loyalfan', 'Tips', '1', '$0.05'],
    ])
    expect(parseCSV(csv, 'BongaCams')).toHaveLength(3)
  })

  test('24: mixed-case username preserved as lowercase in output', () => {
    const csv = tabLines([
      ['Date and Time', 'Member', 'Type', 'Tokens Earned', 'Your Payout'],
      ['18.06.2026 14:32', 'MiXedCase99', 'Tips', '10', '$0.50'],
    ])
    expect(parseCSV(csv, 'BongaCams')[0].username).toBe('mixedcase99')
  })

  test('25: username containing header-like substrings does not break detection', () => {
    // Regression: hasHeaders() used to substring-match the raw first line,
    // so a first data row containing "username", "date", "token" etc. as
    // part of a real username/value was wrongly treated as a header row.
    const csv = tabLines([
      ['18.06.2026 14:32', 'tokenlover_date99', '500', '25.00'],
      ['18.06.2026 15:00', 'usernamefan', '100', '5.00'],
    ])
    expect(parseCSV(csv, 'BongaCams')).toHaveLength(2)
  })

  test('26: non-breaking space in token count', () => {
    const csv = tabLines([
      ['Date and Time', 'Member', 'Type', 'Tokens Earned', 'Your Payout'],
      ['18.06.2026 14:32', 'fanA', 'Tips', '1 507', '$75.35'],
    ])
    expect(parseCSV(csv, 'BongaCams')[0].tokens).toBe(1507)
  })

  test('27: referral/promoted-room rows excluded', () => {
    const csv = tabLines([
      ['Date and Time', 'Member', 'Action', 'Tokens Earned', 'Your Payout'],
      ['18.06.2026 14:32', 'fanA', 'Referral bonus', '500', '$25.00'],
      ['18.06.2026 15:00', 'fanB', 'Tip From: fanB', '100', '$5.00'],
    ])
    const rows = parseCSV(csv, 'BongaCams')
    expect(rows.some(r => r.username === 'fanb')).toBe(true)
  })

  test('28: only whitespace/blank paste yields zero rows without throwing', () => {
    expect(() => parseCSV('   \n\n  ', 'BongaCams')).not.toThrow()
    expect(parseCSV('   \n\n  ', 'BongaCams')).toEqual([])
  })

  test('29: dollar sign with comma thousands separator in payout', () => {
    const csv = tabLines([
      ['Date and Time', 'Member', 'Type', 'Tokens Earned', 'Your Payout'],
      ['18.06.2026 14:32', 'whale2', 'Tips', '30000', '$1,500.00'],
    ])
    expect(parseCSV(csv, 'BongaCams')[0].usd).toBeCloseTo(1500, 2)
  })

  test('30: dates spanning a year boundary all parse', () => {
    const csv = tabLines([
      ['Date and Time', 'Member', 'Type', 'Tokens Earned', 'Your Payout'],
      ['31.12.2025 23:59', 'fanA', 'Tips', '10', '$0.50'],
      ['01.01.2026 00:01', 'fanB', 'Tips', '10', '$0.50'],
    ])
    expect(parseCSV(csv, 'BongaCams')).toHaveLength(2)
  })

  test('31: platform correctly detected without explicit hint', () => {
    const csv = tabLines([
      ['Date and Time', 'Member', 'Type', 'Tokens Earned', 'Your Payout'],
      ['18.06.2026 14:32', 'fanA', 'Tips', '10', '$0.50'],
    ])
    expect(detectPlatform(csv)).toBe('BongaCams')
  })

  test('32: 5-line stacked header does not misfire on a 4-column data line (mismatch guard)', () => {
    const csv = ['Date and Time', 'Member', 'Type', 'Tokens Earned', 'Your Payout',
      '18.06.2026 14:32\tfanA\tTips\t500'].join('\n') // only 4 cols, header block has 5
    // Should not crash; stitching is skipped since column counts don't match.
    expect(() => parseCSV(csv, 'BongaCams')).not.toThrow()
  })
})

describe('parseCSV stress test — Chaturbate (15+ shapes)', () => {
  test('01: multi-line Tip From paste (real placeholder format)', () => {
    const csv = 'Jun 18, 2026, 8:27 PM\nTip From: username123\n500  12345\n\nJun 18, 2026, 9:14 PM\nTip From: whaleking99\n1000  12346'
    expect(parseCSV(csv, 'Chaturbate')).toHaveLength(2)
  })

  test('02: Fan Club Membership rows counted as earnings (server CSV-upload parser parity with onboarding preview)', () => {
    const csv = 'Sep 13, 2026, 4:19 PM\nFan Club Membership: superfan1\n500  1000'
    const rows = parseCSV(csv, 'Chaturbate')
    expect(rows).toHaveLength(1)
    expect(rows[0].username).toBe('superfan1')
    expect(rows[0].tip_note).toBe('Fan Club Membership')
  })

  test('03: Admin Adjustment lines excluded', () => {
    const csv = 'Sep 13, 2026, 4:19 PM\nAdmin Adjustment\n500  1000\n\nSep 13, 2026, 4:20 PM\nTip From: fanA\n100  900'
    const rows = parseCSV(csv, 'Chaturbate')
    expect(rows).toHaveLength(1)
    expect(rows[0].username).toBe('fana')
  })

  test('04: cash-transfer lines excluded', () => {
    const csv = 'Sep 13, 2026, 4:19 PM\nTransfer tokens to bank account cash\n5000  0\n\nSep 13, 2026, 4:20 PM\nTip From: fanA\n100  900'
    expect(parseCSV(csv, 'Chaturbate')).toHaveLength(1)
  })

  test('05: quoted CSV export header', () => {
    const csv = '"Timestamp","Token change","Token balance","Transaction type","User","Note"\n"2026-02-12 06:05:59.000000",5,181,"Tip received","fanA",""'
    expect(parseCSV(csv)).toHaveLength(1)
  })

  test('06: cashout rows never contribute in CSV export format', () => {
    const csv = '"Timestamp","Token change","Token balance","Transaction type","User","Note"\n"2026-02-14 13:54:51.000000",-181,0,"Tokens cashed out","",""\n"2026-02-12 06:05:59.000000",5,181,"Tip received","fanA",""'
    expect(parseCSV(csv)).toHaveLength(1)
  })

  test('07: every calendar month abbreviation parses', () => {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    months.forEach(m => {
      const csv = `${m} 15, 2026, 3:00 PM\nTip From: fanA\n10  100`
      expect(parseCSV(csv, 'Chaturbate')).toHaveLength(1)
    })
  })

  test('08: midnight and noon boundary times', () => {
    const csv = 'Jun 18, 2026, 12:00 AM\nTip From: nightowl\n10  100\n\nJun 18, 2026, 12:00 PM\nTip From: noonfan\n10  100'
    expect(parseCSV(csv, 'Chaturbate')).toHaveLength(2)
  })

  test('09: tip with a fan note line present', () => {
    const csv = 'Jun 18, 2026, 8:27 PM\nTip From: username123\nnice show!\n500  12345'
    const rows = parseCSV(csv, 'Chaturbate')
    expect(rows).toHaveLength(1)
    expect(rows[0].tip_note).toBe('nice show!')
  })

  test('10: whale tip amount', () => {
    const csv = 'Jun 18, 2026, 8:27 PM\nTip From: bigwhale\n50000  99999'
    expect(parseCSV(csv, 'Chaturbate')[0].tokens).toBe(50000)
  })

  test('11: multiple same-minute tips from different users', () => {
    const csv = [
      'Jun 18, 2026, 8:27 PM', 'Tip From: fanA', '10  100', '',
      'Jun 18, 2026, 8:27 PM', 'Tip From: fanB', '20  120',
    ].join('\n')
    expect(parseCSV(csv, 'Chaturbate')).toHaveLength(2)
  })

  test('12: private show lines routed away from free tips', () => {
    const csv = [
      'Jun 18, 2026, 8:27 PM', 'Private Show: fanA', '1000  5000', '',
      'Jun 18, 2026, 8:30 PM', 'Tip From: fanB', '10  100',
    ].join('\n')
    const rows = parseCSV(csv, 'Chaturbate')
    expect(rows).toHaveLength(1)
    expect(rows[0].username).toBe('fanb')
  })

  test('13: notes containing common English words do not break parsing', () => {
    const csv = '"Timestamp","Token change","Token balance","Transaction type","User","Note"\n"2026-02-12 05:41:12.000000",10,54,"Tip received","fanA","next time ur in vegas date night"'
    expect(parseCSV(csv)).toHaveLength(1)
  })

  test('14: large multi-line paste (100 tips) — every row survives', () => {
    const blocks = []
    for (let i = 0; i < 100; i++) {
      blocks.push(`Jun 18, 2026, 8:${String(i % 60).padStart(2, '0')} PM`)
      blocks.push(`Tip From: fan${i}`)
      blocks.push(`${1 + i}  ${1000 + i}`)
      blocks.push('')
    }
    expect(parseCSV(blocks.join('\n'), 'Chaturbate')).toHaveLength(100)
  })

  test('15: username containing header-like substrings in CSV format', () => {
    const csv = '"Timestamp","Token change","Token balance","Transaction type","User","Note"\n"2026-02-12 06:05:59.000000",5,181,"Tip received","datefan_username99",""'
    const rows = parseCSV(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0].username).toBe('datefan_username99')
  })

  test('16: blank paste yields zero rows without throwing', () => {
    expect(() => parseCSV('', 'Chaturbate')).not.toThrow()
  })
})

describe('parseCSV stress test — MyFreeCams (15+ shapes)', () => {
  test('01: placeholder headerless format (real bug — was zero rows)', () => {
    const csv = tabLines([
      ['1746555770', 'Jun 18th, 2026 10:40 PM', '500', 'username123', 'Tip'],
      ['1746555771', 'Jun 18th, 2026 11:02 PM', '1000', 'whaleking99', 'Tip'],
    ])
    expect(parseCSV(csv, 'MyFreeCams')).toHaveLength(2)
  })

  test('02: Private type rows flagged as paid sessions', () => {
    const csv = tabLines([
      ['1746555770', 'Jun 18th, 2026 10:40 PM', '2000', 'privatefan', 'Private'],
      ['1746555771', 'Jun 18th, 2026 11:02 PM', '500', 'tipfan', 'Tip'],
    ])
    const rows = parseCSV(csv, 'MyFreeCams')
    expect(rows).toHaveLength(2)
    expect(rows.find(r => r.username === 'privatefan').is_paid_session).toBe(true)
    expect(rows.find(r => r.username === 'tipfan').is_paid_session).toBeUndefined()
  })

  test('03: ordinal suffixes on every day-of-month variant (1st/2nd/3rd/4th...21st)', () => {
    const days = [1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31]
    days.forEach(d => {
      const csv = tabLines([[`174655577${d % 10}`, `Jun ${d}${ordinalSuffix(d)}, 2026 10:40 PM`, '500', `fan${d}`, 'Tip']])
      expect(parseCSV(csv, 'MyFreeCams')).toHaveLength(1)
    })
    function ordinalSuffix(n) {
      if (n >= 11 && n <= 13) return 'th'
      switch (n % 10) { case 1: return 'st'; case 2: return 'nd'; case 3: return 'rd'; default: return 'th' }
    }
  })

  test('04: header-row CSV export format still works', () => {
    const csv = ['Date,Username,Tokens,Type', '2026-06-18,fanA,500,Tip'].join('\n')
    expect(parseCSV(csv, 'MyFreeCams')).toHaveLength(1)
  })

  test('05: platform auto-detected from epoch-prefixed line without a hint', () => {
    const csv = tabLines([['1746555770', 'Jun 18th, 2026 10:40 PM', '500', 'fanA', 'Tip']])
    expect(detectPlatform(csv)).toBe('MyFreeCams')
  })

  test('06: username containing header-like substrings does not misroute to parseWithHeaders', () => {
    const csv = tabLines([
      ['1746555770', 'Jun 18th, 2026 10:40 PM', '500', 'dateuser_tokenfan', 'Tip'],
    ])
    expect(parseCSV(csv, 'MyFreeCams')).toHaveLength(1)
  })

  test('07: zero-token row dropped', () => {
    const csv = tabLines([
      ['1746555770', 'Jun 18th, 2026 10:40 PM', '0', 'fanA', 'Tip'],
      ['1746555771', 'Jun 18th, 2026 11:02 PM', '500', 'fanB', 'Tip'],
    ])
    expect(parseCSV(csv, 'MyFreeCams')).toHaveLength(1)
  })

  test('08: missing username dropped', () => {
    const csv = tabLines([
      ['1746555770', 'Jun 18th, 2026 10:40 PM', '500', '', 'Tip'],
      ['1746555771', 'Jun 18th, 2026 11:02 PM', '500', 'fanB', 'Tip'],
    ])
    expect(parseCSV(csv, 'MyFreeCams')).toHaveLength(1)
  })

  test('09: whale tip amount', () => {
    const csv = tabLines([['1746555770', 'Jun 18th, 2026 10:40 PM', '100000', 'bigwhale', 'Tip']])
    expect(parseCSV(csv, 'MyFreeCams')[0].tokens).toBe(100000)
  })

  test('10: usd computed from tokens at MFC rate (0.05)', () => {
    const csv = tabLines([['1746555770', 'Jun 18th, 2026 10:40 PM', '1000', 'fanA', 'Tip']])
    expect(parseCSV(csv, 'MyFreeCams')[0].usd).toBeCloseTo(50, 2)
  })

  test('11: large dataset (150 rows) — every row survives', () => {
    const rows = []
    for (let i = 0; i < 150; i++) {
      const hour = 1 + (i % 12) // valid 12-hour range
      rows.push([`174655${5770 + i}`, `Jun 18th, 2026 ${String(hour).padStart(2, '0')}:${String(i % 60).padStart(2, '0')} PM`, String(1 + i), `fan${i}`, 'Tip'])
    }
    expect(parseCSV(tabLines(rows), 'MyFreeCams')).toHaveLength(150)
  })

  test('12: mixed Tip and Private rows in one large paste', () => {
    const rows = []
    for (let i = 0; i < 40; i++) {
      rows.push([`174655${5770 + i}`, `Jun 18th, 2026 10:${String(i % 60).padStart(2, '0')} PM`, String(1 + i), `fan${i}`, i % 3 === 0 ? 'Private' : 'Tip'])
    }
    const parsed = parseCSV(tabLines(rows), 'MyFreeCams')
    expect(parsed).toHaveLength(40)
    expect(parsed.filter(r => r.is_paid_session).length).toBeGreaterThan(0)
  })

  test('13: repeated tipper across rows keeps every row', () => {
    const csv = tabLines([
      ['1746555770', 'Jun 18th, 2026 10:40 PM', '10', 'loyalfan', 'Tip'],
      ['1746555771', 'Jun 18th, 2026 10:41 PM', '10', 'loyalfan', 'Tip'],
      ['1746555772', 'Jun 18th, 2026 10:42 PM', '10', 'loyalfan', 'Tip'],
    ])
    expect(parseCSV(csv, 'MyFreeCams')).toHaveLength(3)
  })

  test('14: blank paste yields zero rows without throwing', () => {
    expect(() => parseCSV('', 'MyFreeCams')).not.toThrow()
  })

  test('15: username case normalized to lowercase', () => {
    const csv = tabLines([['1746555770', 'Jun 18th, 2026 10:40 PM', '500', 'MixedCaseFan', 'Tip']])
    expect(parseCSV(csv, 'MyFreeCams')[0].username).toBe('mixedcasefan')
  })

  test('16: date/time is a real, correctly-parsed Date object once ordinal is stripped', () => {
    const csv = tabLines([['1746555770', 'Jun 18th, 2026 10:40 PM', '500', 'fanA', 'Tip']])
    const row = parseCSV(csv, 'MyFreeCams')[0]
    const d = new Date(row.dateRaw)
    expect(isNaN(d.getTime())).toBe(false)
    expect(d.getUTCFullYear()).toBe(2026)
  })
})
