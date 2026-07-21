'use client'
import { useState } from 'react'
import {
  T, Card, SectionLabel, FieldLabel, TextInput, TextArea, Select, PillGroup, SingleSelectPills,
  PrimaryButton, SecondaryButton, StepDots, LoadingStaged, ErrorBanner, EmptyState, Badge,
} from './theme'
import BioResultCard from './BioResultCard'
import {
  ALL_PLATFORMS, AGE_DISPLAY_OPTIONS, EXPERIENCE_LEVELS, PERSONA_TAGS, TONE_OPTIONS,
  SERVICE_OPTIONS, PRIMARY_CTA_OPTIONS, WEEKDAYS, BIO_FORMATS, BIO_LENGTHS, EMOJI_LEVELS,
  BIO_LOADING_MESSAGES,
} from '../../../../lib/profileStudio/constants'

const STEPS = ['Identity', 'Persona', 'Content', 'Schedule', 'Generate']

function buildInitialForm(shared) {
  return {
    identity: {
      displayName: shared?.displayName || '',
      username: shared?.usernames?.primary || '',
      pronouns: shared?.pronouns || '',
      ageDisplay: shared?.ageDisplay || 'none',
      ageDisplayValue: shared?.ageDisplayValue || '',
      locationGeneral: shared?.locationGeneral || '',
      languages: shared?.languages || [],
      experienceLevel: shared?.experienceLevel || 'new',
      platforms: shared?.platforms || [],
    },
    persona: {
      personaTags: shared?.personaTags || [],
      personalityWords: shared?.personalityWords || [],
      desiredAudience: shared?.desiredAudience || '',
      brandColors: shared?.brandColors || [],
      signaturePhrase: shared?.signaturePhrase || '',
      roomDifference: shared?.roomDifference || '',
      strongestQualities: shared?.strongestQualities || '',
      tone: shared?.tone || [],
    },
    content: {
      services: shared?.services || [],
      boundaries: {
        hardNo: shared?.boundaries?.hardNo || [],
        topics: shared?.boundaries?.topics || '',
        mentionPublicly: shared?.boundaries?.mentionPublicly || false,
        softPhrase: shared?.boundaries?.softPhrase ?? true,
        ageReminder: shared?.boundaries?.ageReminder || false,
      },
    },
    schedule: {
      days: shared?.schedule?.days || [],
      hours: shared?.schedule?.hours || '',
      timezone: shared?.schedule?.timezone || '',
      consistent: shared?.schedule?.consistent ?? true,
      ctaPrimary: shared?.ctaPrimary || '',
      ctaSecondary: shared?.ctaSecondary || '',
      socialUsernames: shared?.socialUsernames || {},
    },
  }
}

export default function BioGenerator({ isLoggedIn, isPro, sharedProfile, onSharedProfileChange }) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(() => buildInitialForm(sharedProfile))
  const [format, setFormat] = useState('short_cam_bio')
  const [length, setLength] = useState('medium')
  const [emoji, setEmoji] = useState('minimal')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [warnings, setWarnings] = useState([])
  const [bios, setBios] = useState(null)
  const [hardNoText, setHardNoText] = useState('')

  const [improveText, setImproveText] = useState('')
  const [improveLoading, setImproveLoading] = useState(false)
  const [improveResult, setImproveResult] = useState(null)
  const [improveError, setImproveError] = useState('')

  const patch = (section, field, value) => setForm(f => ({ ...f, [section]: { ...f[section], [field]: value } }))
  const patchNested = (section, sub, field, value) => setForm(f => ({ ...f, [section]: { ...f[section], [sub]: { ...f[section][sub], [field]: value } } }))
  const toggleIn = (section, field, id) => setForm(f => {
    const cur = f[section][field]
    const next = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]
    return { ...f, [section]: { ...f[section], [field]: next } }
  })

  const pushSharedProfile = () => {
    onSharedProfileChange?.({
      displayName: form.identity.displayName,
      pronouns: form.identity.pronouns,
      ageDisplay: form.identity.ageDisplay,
      ageDisplayValue: form.identity.ageDisplayValue,
      locationGeneral: form.identity.locationGeneral,
      languages: form.identity.languages,
      experienceLevel: form.identity.experienceLevel,
      platforms: form.identity.platforms,
      personaTags: form.persona.personaTags,
      personalityWords: form.persona.personalityWords,
      desiredAudience: form.persona.desiredAudience,
      brandColors: form.persona.brandColors,
      signaturePhrase: form.persona.signaturePhrase,
      roomDifference: form.persona.roomDifference,
      strongestQualities: form.persona.strongestQualities,
      tone: form.persona.tone,
      services: form.content.services,
      boundaries: form.content.boundaries,
      schedule: { days: form.schedule.days, hours: form.schedule.hours, timezone: form.schedule.timezone, consistent: form.schedule.consistent },
      ctaPrimary: form.schedule.ctaPrimary,
      ctaSecondary: form.schedule.ctaSecondary,
    })
  }

  const goNext = () => { pushSharedProfile(); setStep(s => Math.min(s + 1, STEPS.length - 1)) }
  const goBack = () => setStep(s => Math.max(s - 1, 0))

  const handleGenerate = async () => {
    setError('')
    setLoading(true)
    setBios(null)
    pushSharedProfile()
    try {
      const res = await fetch('/api/profile-studio/bio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: form.identity, persona: form.persona, content: form.content, schedule: form.schedule, format, length, emoji }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.')
        return
      }
      setBios(data.bios)
      setWarnings(data.warnings || [])
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveBio = async (id, text) => {
    await fetch('/api/profile-studio/bios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, generatedText: text }),
    })
    setBios(prev => prev.map(b => (b.id === id ? { ...b, text, characterCount: text.length } : b)))
  }

  const handleImprove = async () => {
    setImproveError('')
    setImproveLoading(true)
    setImproveResult(null)
    try {
      const res = await fetch('/api/profile-studio/bio/improve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ existingBio: improveText, format }),
      })
      const data = await res.json()
      if (!res.ok) {
        setImproveError(data.error || 'Something went wrong.')
        return
      }
      setImproveResult(data)
    } catch {
      setImproveError('Network error. Please try again.')
    } finally {
      setImproveLoading(false)
    }
  }

  if (!isLoggedIn) {
    return (
      <EmptyState
        icon="🔒"
        title="Sign in to build your bio"
        description="Build a bio that sounds like you—not a generic template. Sign in to generate, save, and edit your Cam Bio."
      />
    )
  }

  return (
    <div>
      <StepDots steps={STEPS} current={step} />
      <ErrorBanner message={error} onDismiss={() => setError('')} />

      {step === 0 && (
        <Card className="ps-fade">
          <SectionLabel>Step 1 · Creator identity</SectionLabel>
          <div className="ps-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <FieldLabel htmlFor="bio-display-name" required>Display name</FieldLabel>
              <TextInput id="bio-display-name" value={form.identity.displayName} maxLength={60} onChange={e => patch('identity', 'displayName', e.target.value)} placeholder="e.g. Luna Hart" />
            </div>
            <div>
              <FieldLabel htmlFor="bio-username" hint="optional">Username</FieldLabel>
              <TextInput id="bio-username" value={form.identity.username} maxLength={60} onChange={e => patch('identity', 'username', e.target.value)} placeholder="e.g. lunahart" />
            </div>
            <div>
              <FieldLabel htmlFor="bio-pronouns" hint="optional">Pronouns</FieldLabel>
              <TextInput id="bio-pronouns" value={form.identity.pronouns} maxLength={30} onChange={e => patch('identity', 'pronouns', e.target.value)} placeholder="she/her" />
            </div>
            <div>
              <FieldLabel htmlFor="bio-location" hint="optional">General location</FieldLabel>
              <TextInput id="bio-location" value={form.identity.locationGeneral} maxLength={80} onChange={e => patch('identity', 'locationGeneral', e.target.value)} placeholder="e.g. West Coast, USA" />
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <FieldLabel>Age display preference</FieldLabel>
            <SingleSelectPills options={AGE_DISPLAY_OPTIONS} value={form.identity.ageDisplay} onChange={v => patch('identity', 'ageDisplay', v)} />
            {form.identity.ageDisplay === 'custom' && (
              <TextInput aria-label="Custom age display text" style={{ marginTop: 8, maxWidth: 200 }} value={form.identity.ageDisplayValue} maxLength={20} onChange={e => patch('identity', 'ageDisplayValue', e.target.value)} placeholder='e.g. "18+"' />
            )}
          </div>

          <div style={{ marginTop: 16 }}>
            <FieldLabel htmlFor="bio-languages" hint="comma separated, optional">Languages spoken</FieldLabel>
            <TextInput
              id="bio-languages"
              value={form.identity.languages.join(', ')}
              onChange={e => patch('identity', 'languages', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              placeholder="English, Spanish"
            />
          </div>

          <div style={{ marginTop: 16 }}>
            <FieldLabel>Experience level</FieldLabel>
            <SingleSelectPills options={EXPERIENCE_LEVELS} value={form.identity.experienceLevel} onChange={v => patch('identity', 'experienceLevel', v)} />
          </div>

          <div style={{ marginTop: 16 }}>
            <FieldLabel>Main platforms</FieldLabel>
            <PillGroup options={ALL_PLATFORMS} value={form.identity.platforms} onToggle={id => toggleIn('identity', 'platforms', id)} />
          </div>
        </Card>
      )}

      {step === 1 && (
        <Card className="ps-fade">
          <SectionLabel>Step 2 · Persona and brand</SectionLabel>
          <FieldLabel>Persona (select all that apply)</FieldLabel>
          <PillGroup options={PERSONA_TAGS} value={form.persona.personaTags} onToggle={id => toggleIn('persona', 'personaTags', id)} />

          <div style={{ marginTop: 18 }}>
            <FieldLabel htmlFor="bio-personality-words" hint="up to 3">Three words describing your personality</FieldLabel>
            <TextInput
              id="bio-personality-words"
              value={form.persona.personalityWords.join(', ')}
              onChange={e => patch('persona', 'personalityWords', e.target.value.split(',').map(s => s.trim()).filter(Boolean).slice(0, 3))}
              placeholder="playful, confident, warm"
            />
          </div>

          <div className="ps-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
            <div>
              <FieldLabel htmlFor="bio-audience" hint="optional">Desired audience</FieldLabel>
              <TextInput id="bio-audience" value={form.persona.desiredAudience} maxLength={200} onChange={e => patch('persona', 'desiredAudience', e.target.value)} placeholder="e.g. regulars who like conversation" />
            </div>
            <div>
              <FieldLabel htmlFor="bio-signature" hint="optional">Signature phrase</FieldLabel>
              <TextInput id="bio-signature" value={form.persona.signaturePhrase} maxLength={120} onChange={e => patch('persona', 'signaturePhrase', e.target.value)} placeholder="e.g. Let's make it a good one." />
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <FieldLabel htmlFor="bio-room-difference" hint="optional">What makes your room different</FieldLabel>
            <TextArea id="bio-room-difference" value={form.persona.roomDifference} maxLength={300} onChange={e => patch('persona', 'roomDifference', e.target.value)} placeholder="e.g. real conversation, no scripted chat" />
          </div>

          <div style={{ marginTop: 16 }}>
            <FieldLabel htmlFor="bio-qualities" hint="optional">Your strongest qualities</FieldLabel>
            <TextArea id="bio-qualities" value={form.persona.strongestQualities} maxLength={300} onChange={e => patch('persona', 'strongestQualities', e.target.value)} placeholder="e.g. great listener, high energy shows" />
          </div>

          <div style={{ marginTop: 16 }}>
            <FieldLabel>Desired tone</FieldLabel>
            <PillGroup options={TONE_OPTIONS} value={form.persona.tone} onToggle={id => toggleIn('persona', 'tone', id)} />
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className="ps-fade">
          <SectionLabel>Step 3 · Content and boundaries</SectionLabel>
          <FieldLabel>What do you offer?</FieldLabel>
          <PillGroup options={SERVICE_OPTIONS} value={form.content.services} onToggle={id => toggleIn('content', 'services', id)} />

          <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${T.borderSoft}` }}>
            <FieldLabel htmlFor="bio-hard-no" hint="press Enter to add, optional">Hard no items</FieldLabel>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <TextInput
                id="bio-hard-no"
                value={hardNoText}
                onChange={e => setHardNoText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && hardNoText.trim()) {
                    e.preventDefault()
                    patchNested('content', 'boundaries', 'hardNo', [...form.content.boundaries.hardNo, hardNoText.trim()])
                    setHardNoText('')
                  }
                }}
                placeholder="Type a boundary and press Enter"
              />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {form.content.boundaries.hardNo.map((item, i) => (
                <Badge key={i} color={T.red}>
                  {item}{' '}
                  <button onClick={() => patchNested('content', 'boundaries', 'hardNo', form.content.boundaries.hardNo.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', marginLeft: 4 }}>✕</button>
                </Badge>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <FieldLabel htmlFor="bio-topics" hint="optional">Topics or requests you don't allow</FieldLabel>
            <TextArea id="bio-topics" value={form.content.boundaries.topics} maxLength={400} onChange={e => patchNested('content', 'boundaries', 'topics', e.target.value)} placeholder="Describe anything else off-limits" />
          </div>

          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13.5, color: T.soft }}>
              <input type="checkbox" checked={form.content.boundaries.mentionPublicly} onChange={e => patchNested('content', 'boundaries', 'mentionPublicly', e.target.checked)} />
              Mention my boundaries publicly in the bio
            </label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13.5, color: T.soft }}>
              <input type="checkbox" checked={form.content.boundaries.softPhrase} onChange={e => patchNested('content', 'boundaries', 'softPhrase', e.target.checked)} />
              Use a soft phrase like "Please respect my limits"
            </label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13.5, color: T.soft }}>
              <input type="checkbox" checked={form.content.boundaries.ageReminder} onChange={e => patchNested('content', 'boundaries', 'ageReminder', e.target.checked)} />
              Include an 18+ reminder
            </label>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card className="ps-fade">
          <SectionLabel>Step 4 · Schedule and calls to action</SectionLabel>
          <FieldLabel>Typical streaming days</FieldLabel>
          <PillGroup options={WEEKDAYS} value={form.schedule.days} onToggle={id => toggleIn('schedule', 'days', id)} />

          <div className="ps-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
            <div>
              <FieldLabel htmlFor="bio-hours" hint="optional">Typical streaming hours</FieldLabel>
              <TextInput id="bio-hours" value={form.schedule.hours} maxLength={60} onChange={e => patch('schedule', 'hours', e.target.value)} placeholder="e.g. evenings, 8-11pm" />
            </div>
            <div>
              <FieldLabel htmlFor="bio-timezone" hint="optional">Time zone</FieldLabel>
              <TextInput id="bio-timezone" value={form.schedule.timezone} maxLength={60} onChange={e => patch('schedule', 'timezone', e.target.value)} placeholder="e.g. EST" />
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <FieldLabel>Is your schedule consistent?</FieldLabel>
            <SingleSelectPills
              options={[{ id: 'true', label: 'Consistent' }, { id: 'false', label: 'Changes weekly' }]}
              value={String(form.schedule.consistent)}
              onChange={v => patch('schedule', 'consistent', v === 'true')}
            />
          </div>

          <div style={{ marginTop: 16 }}>
            <FieldLabel>Main call to action</FieldLabel>
            <SingleSelectPills options={PRIMARY_CTA_OPTIONS} value={form.schedule.ctaPrimary} onChange={v => patch('schedule', 'ctaPrimary', v)} />
          </div>

          <div style={{ marginTop: 16 }}>
            <FieldLabel hint="optional">Secondary call to action</FieldLabel>
            <SingleSelectPills options={PRIMARY_CTA_OPTIONS} value={form.schedule.ctaSecondary} onChange={v => patch('schedule', 'ctaSecondary', v)} />
          </div>
        </Card>
      )}

      {step === 4 && (
        <Card className="ps-fade">
          <SectionLabel>Step 5 · Platform format</SectionLabel>
          <FieldLabel htmlFor="bio-format">Generate as</FieldLabel>
          <Select id="bio-format" value={format} onChange={e => setFormat(e.target.value)} style={{ maxWidth: 340, marginBottom: 16 }}>
            {BIO_FORMATS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </Select>

          <FieldLabel>Length</FieldLabel>
          <SingleSelectPills options={BIO_LENGTHS} value={length} onChange={setLength} />

          <div style={{ marginTop: 16 }}>
            <FieldLabel>Emoji usage</FieldLabel>
            <SingleSelectPills options={EMOJI_LEVELS} value={emoji} onChange={setEmoji} />
          </div>

          <div style={{ marginTop: 22 }}>
            <PrimaryButton onClick={handleGenerate} disabled={loading || !form.identity.displayName}>
              {loading ? 'Generating…' : '✨ Generate my bio'}
            </PrimaryButton>
            {!form.identity.displayName && <div style={{ fontSize: 12, color: T.faint, marginTop: 8 }}>Add a display name in Step 1 to generate.</div>}
          </div>
        </Card>
      )}

      {step < 4 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18 }}>
          <SecondaryButton onClick={goBack} disabled={step === 0}>← Back</SecondaryButton>
          <PrimaryButton onClick={goNext}>Continue →</PrimaryButton>
        </div>
      )}
      {step === 4 && step > 0 && (
        <div style={{ marginTop: 12 }}>
          <SecondaryButton onClick={goBack}>← Back</SecondaryButton>
        </div>
      )}

      <LoadingStaged messages={BIO_LOADING_MESSAGES} active={loading} />

      {!loading && bios && (
        <div className="ps-fade" style={{ marginTop: 28 }}>
          <SectionLabel>Your generated bios</SectionLabel>
          {warnings.length > 0 && (
            <div style={{ marginBottom: 14, fontSize: 12.5, color: T.gold, background: 'rgba(255,200,87,0.08)', border: '1px solid rgba(255,200,87,0.25)', borderRadius: 10, padding: '10px 14px' }}>
              {warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
            </div>
          )}
          <div className="ps-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            {bios.map(bio => (
              <BioResultCard key={bio.id} bio={bio} onSave={handleSaveBio} onRegenerate={handleGenerate} regenerating={loading} />
            ))}
          </div>
        </div>
      )}

      {!bios && !loading && step === 4 && (
        <EmptyState title="Build a bio that sounds like you—not a generic template." description="Fill out your identity, persona, content, and schedule, then generate three versions to choose from." />
      )}

      <div style={{ marginTop: 40, paddingTop: 28, borderTop: `1px solid ${T.borderSoft}` }}>
        <SectionLabel htmlFor="bio-improve-text">Improve my existing bio {!isPro && <Badge color={T.gold} style={{ marginLeft: 8 }}>Pro</Badge>}</SectionLabel>
        <p style={{ fontSize: 13, color: T.muted, marginBottom: 12 }}>Paste your current bio and get a short explanation of what's weak, followed by a revised version.</p>
        <TextArea id="bio-improve-text" aria-label="Existing bio to improve" value={improveText} maxLength={4000} onChange={e => setImproveText(e.target.value)} placeholder="Paste your current bio here…" disabled={!isPro} />
        <div style={{ marginTop: 10 }}>
          <SecondaryButton onClick={handleImprove} disabled={!isPro || improveLoading || !improveText.trim()}>
            {improveLoading ? 'Analyzing…' : isPro ? 'Improve my bio' : 'Upgrade to unlock'}
          </SecondaryButton>
        </div>
        <ErrorBanner message={improveError} onDismiss={() => setImproveError('')} />
        {improveResult && (
          <Card style={{ marginTop: 16 }} className="ps-fade">
            <div style={{ fontSize: 13, fontWeight: 700, color: T.cyan, marginBottom: 8 }}>What was improved</div>
            <ul style={{ margin: '0 0 12px', paddingLeft: 18, color: T.muted, fontSize: 13, lineHeight: 1.7 }}>
              {improveResult.improvements.map((imp, i) => <li key={i}>{imp}</li>)}
            </ul>
            <p style={{ fontSize: 13, color: T.soft, marginBottom: 14 }}>{improveResult.explanation}</p>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.pink, marginBottom: 8 }}>Revised bio</div>
            <p style={{ fontSize: 14.5, lineHeight: 1.65, color: T.white, whiteSpace: 'pre-wrap' }}>{improveResult.revisedBio}</p>
            <div style={{ fontSize: 11.5, color: T.faint }}>{improveResult.characterCount} characters</div>
          </Card>
        )}
      </div>
    </div>
  )
}
