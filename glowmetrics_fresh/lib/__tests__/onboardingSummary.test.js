jest.mock('../supabase',()=>({supabase:{}}))
import { parseCSV } from '../analytics'
import { summarizeOnboarding, assertImportComplete } from '../onboardingSummary'
import { buildPreview } from '../../app/onboarding/page'
import { controlPaste, controlFile } from './fixtures/onboardingControl'

const expected={
  tips:{count:994,tokens:6331,usd:316.55},
  private:{count:95,tokens:857,usd:42.85},
  memberships:{count:2,tokens:200,usd:10},
  other:{count:0,tokens:0,usd:0},
}
test('control totals and paste/file parity use the same category contract',()=>{
  const paste=buildPreview(controlPaste(),'chaturbate','Chaturbate','America/Los_Angeles')
  const file=summarizeOnboarding(parseCSV(controlFile(),'Chaturbate'),'America/Los_Angeles')
  for(const s of [paste.snapshot,file]){
    expect(s.full.categories).toEqual(expected)
    expect(s.full).toMatchObject({tips:994,usd:369.4,fans:235,tokens:7388})
    expect(s.recent.categories).toEqual(expected)
  }
  expect(paste.tipsDetected).toBe(994)
  expect(paste.snapshot).toEqual(file)
})
test('private-only exports remain importable',()=>{
  const raw='Oct 10, 2026, 8:00 PM\nPrivate Show: fan\n857  1000'
  const p=buildPreview(raw,'chaturbate','Chaturbate')
  expect(p).toMatchObject({tipsDetected:0,paidSessionsDetected:1,estimatedEarnings:42.85})
  expect(p.snapshot.full.categories.private).toEqual({count:1,tokens:857,usd:42.85})
})
test('recent window includes private/membership revenue, excluding them and social sales from Tips',()=>{
  const rows=[
    {date_time:'2026-01-01T00:00:00Z',username:'old',tokens:100,usd:5,tip_type:'Tip'},
    {date_time:'2026-03-01T00:00:00Z',username:'fanA',tokens:10,usd:0.5,tip_type:'Tip'},
    {date_time:'2026-03-01T00:00:00Z',username:'FANA',tokens:20,usd:1,is_paid_session:true},
    {date_time:'2026-03-01T00:00:00Z',username:'fanB',tokens:30,usd:1.5,tip_type:'Membership'},
    {date_time:'2026-03-01T00:00:00Z',username:'fanC',tokens:40,usd:2,tip_type:'Other Sale'},
  ]
  const s=summarizeOnboarding(rows)
  expect(s.recent).toMatchObject({tips:1,usd:3,fans:3})
  expect(s.recent.categories.other).toEqual({count:1,tokens:40,usd:2})
  expect(s.full.usd).toBe(8)
})
test('social sales stay separate for pasted and header-based imports',()=>{
  for(const text of ['Oct 10, 2026, 8:00 PM\nSnapchat Sale: fan\n20  100','Date,Action,Tokens\n"Oct 10, 2026, 8:00 PM",Snapchat Sale: fan,20']){
    const s=summarizeOnboarding(parseCSV(text,'Chaturbate'))
    expect(s.full.tips).toBe(0)
    expect(s.full.categories.other.count).toBe(1)
  }
})
test('peak hour and distinct-day confidence use creator timezone, including DST',()=>{
  const rows=[{date_time:'2026-03-08T09:30:00Z',tokens:10,usd:0.5},{date_time:'2026-03-09T08:30:00Z',tokens:10,usd:0.5}]
  const la=summarizeOnboarding(rows,'America/Los_Angeles')
  expect(la.bestHour).toBe('1am');expect(la.bestHourConfident).toBe(true)
  expect(summarizeOnboarding(rows,'UTC').bestHourConfident).toBe(false)
  expect(summarizeOnboarding(rows.slice(0,1),'America/Los_Angeles').bestHourConfident).toBe(false)
})
test('response validation accepts dedup success and rejects partial paid failures',()=>{
  expect(()=>assertImportComplete({ok:true,inserted:0,paidSessionsInserted:0,paidSessionsSkipped:95})).not.toThrow()
  expect(()=>assertImportComplete({ok:true,paidSessionsWarnings:[{error:'failed'}]})).toThrow(/Some rows could not be saved/)
  expect(()=>assertImportComplete({ok:false,warnings:[{error:'failed'}]})).toThrow()
})
