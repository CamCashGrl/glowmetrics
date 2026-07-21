'use client'
import { useState } from 'react'
import {
  T, Card, SectionLabel, FieldLabel, TextInput, TextArea, Select, PillGroup, SingleSelectPills,
  PrimaryButton, TagInput, ErrorBanner, CompletionTracker, GuidancePanel,
} from '../../tools/profile-studio/components/theme'
import {
  ALL_PLATFORMS, PERSONA_TAGS, TONE_OPTIONS, AUDIENCE_TAGS, EMOJI_LEVELS,
  COMFORT_LEVELS, BIO_FORMATS, PRICING_STRATEGIES,
} from '../../../lib/profileStudio/constants'

// Every field here maps onto the SAME creator_profiles row the public
// Creator Profile Studio reads/writes (see lib/profileStudio + the
// /api/profile-studio/profile route) — nothing is stored separately for
// Brand Studio. Most fields already existed on that table; the handful that
// didn't (emoji style, always/never words, website, notes, comfort level,
// audience tags, defaults) live in the single additive `brandSettings` JSON
// bucket rather than new columns.
export default function BrandProfileEditor({ profile, onChange, onSave }) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const bs = profile?.brandSettings || {}
  const boundaries = profile?.boundaries || {}
  const social = profile?.socialUsernames || {}

  const patch = (field, value) => onChange({ [field]: value })
  const patchBrandSettings = (key, value) => onChange({ brandSettings: { ...bs, [key]: value } })
  const patchBoundaries = (key, value) => onChange({ boundaries: { ...boundaries, [key]: value } })
  const patchSocial = (key, value) => onChange({ socialUsernames: { ...social, [key]: value } })

  const toggleArray = (field, id) => {
    const cur = profile?.[field] || []
    onChange({ [field]: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id] })
  }
  const toggleAudienceTag = id => {
    const cur = bs.audienceTags || []
    patchBrandSettings('audienceTags', cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id])
  }

  const checklist = [
    { label: 'Stage name', done: !!profile?.displayName?.trim() },
    { label: 'Primary platform', done: !!bs.primaryPlatform },
    { label: 'Persona', done: (profile?.personaTags || []).length > 0 },
    { label: 'Tone', done: (profile?.tone || []).length > 0 },
    { label: 'Audience', done: (bs.audienceTags || []).length > 0 || !!profile?.desiredAudience?.trim() },
    { label: 'Emoji style', done: !!bs.emojiStyle },
    { label: 'Boundaries / comfort level', done: !!bs.comfortLevel },
  ]
  const completionPercent = Math.round((checklist.filter(c => c.done).length / checklist.length) * 100)

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      await onSave()
      setSaved(true)
      setTimeout(() => setSaved(false), 1800)
    } catch {
      setError('Something went wrong saving your brand profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <CompletionTracker percent={completionPercent} checklist={checklist} />
      <ErrorBanner message={error} onDismiss={() => setError('')} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 20, alignItems: 'start' }}>
        <div>
          <Card style={{ marginBottom: 16 }}>
            <SectionLabel>Identity</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <FieldLabel htmlFor="bp-stage-name" required>Stage name</FieldLabel>
                <TextInput id="bp-stage-name" value={profile?.displayName || ''} maxLength={60} onChange={e => patch('displayName', e.target.value)} placeholder="e.g. Luna Hart" />
              </div>
              <div>
                <FieldLabel htmlFor="bp-primary-platform">Primary platform</FieldLabel>
                <Select id="bp-primary-platform" value={bs.primaryPlatform || ''} onChange={e => patchBrandSettings('primaryPlatform', e.target.value)}>
                  <option value="">Select a platform</option>
                  {ALL_PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                </Select>
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <FieldLabel hint="every platform you're active on">All platforms</FieldLabel>
              <PillGroup options={ALL_PLATFORMS} value={profile?.platforms || []} onToggle={id => toggleArray('platforms', id)} />
            </div>
            <div style={{ marginTop: 16 }}>
              <FieldLabel htmlFor="bp-website" hint="optional">Website / public link</FieldLabel>
              <TextInput id="bp-website" value={bs.website || ''} maxLength={200} onChange={e => patchBrandSettings('website', e.target.value)} placeholder="https://..." />
            </div>
          </Card>

          <Card style={{ marginBottom: 16 }}>
            <SectionLabel>Persona and tone</SectionLabel>
            <FieldLabel>Persona (select all that apply)</FieldLabel>
            <PillGroup options={PERSONA_TAGS} value={profile?.personaTags || []} onToggle={id => toggleArray('personaTags', id)} />
            <div style={{ marginTop: 18 }}>
              <FieldLabel>Tone (select all that apply)</FieldLabel>
              <PillGroup options={TONE_OPTIONS} value={profile?.tone || []} onToggle={id => toggleArray('tone', id)} />
            </div>
            <div style={{ marginTop: 18 }}>
              <FieldLabel>Emoji style</FieldLabel>
              <SingleSelectPills options={EMOJI_LEVELS} value={bs.emojiStyle || 'minimal'} onChange={v => patchBrandSettings('emojiStyle', v)} />
            </div>
          </Card>

          <Card style={{ marginBottom: 16 }}>
            <SectionLabel>Audience</SectionLabel>
            <FieldLabel>Who you want more of</FieldLabel>
            <PillGroup options={AUDIENCE_TAGS} value={bs.audienceTags || []} onToggle={toggleAudienceTag} />
            <div style={{ marginTop: 16 }}>
              <FieldLabel htmlFor="bp-audience-notes" hint="optional, any extra detail">Audience notes</FieldLabel>
              <TextInput id="bp-audience-notes" value={profile?.desiredAudience || ''} maxLength={200} onChange={e => patch('desiredAudience', e.target.value)} placeholder="e.g. regulars who like conversation" />
            </div>
          </Card>

          <Card style={{ marginBottom: 16 }}>
            <SectionLabel>Brand voice</SectionLabel>
            <FieldLabel htmlFor="bp-brand-colors" hint="press Enter to add">Brand colors</FieldLabel>
            <TagInput value={profile?.brandColors || []} onChange={v => patch('brandColors', v)} placeholder="e.g. #16F4FF or hot pink" ariaLabel="Brand colors" badgeColor={T.cyan} />

            <div style={{ marginTop: 18 }}>
              <FieldLabel htmlFor="bp-always-use" hint="words or phrases you always want used — press Enter to add">Always use</FieldLabel>
              <TagInput value={bs.alwaysUseWords || []} onChange={v => patchBrandSettings('alwaysUseWords', v)} placeholder="Type a word or phrase and press Enter" ariaLabel="Words to always use" badgeColor={T.green} />
            </div>
            <div style={{ marginTop: 18 }}>
              <FieldLabel htmlFor="bp-never-use" hint="words or phrases to avoid — press Enter to add">Never use</FieldLabel>
              <TagInput value={bs.neverUseWords || []} onChange={v => patchBrandSettings('neverUseWords', v)} placeholder="Type a word or phrase and press Enter" ariaLabel="Words to never use" badgeColor={T.red} />
            </div>
          </Card>

          <Card style={{ marginBottom: 16 }}>
            <SectionLabel>Comfort level and boundaries</SectionLabel>
            <FieldLabel>Comfort level</FieldLabel>
            <SingleSelectPills options={COMFORT_LEVELS} value={bs.comfortLevel || 'moderate'} onChange={v => patchBrandSettings('comfortLevel', v)} />
            <div style={{ marginTop: 16 }}>
              <FieldLabel htmlFor="bp-hard-no" hint="press Enter to add">Hard no items</FieldLabel>
              <TagInput value={boundaries.hardNo || []} onChange={v => patchBoundaries('hardNo', v)} placeholder="Type a boundary and press Enter" ariaLabel="Hard no items" badgeColor={T.red} />
            </div>
            <div style={{ marginTop: 16 }}>
              <FieldLabel htmlFor="bp-topics" hint="optional">Topics or requests you don't allow</FieldLabel>
              <TextArea id="bp-topics" value={boundaries.topics || ''} maxLength={400} onChange={e => patchBoundaries('topics', e.target.value)} placeholder="Describe anything else off-limits" />
            </div>
          </Card>

          <Card style={{ marginBottom: 16 }}>
            <SectionLabel>Social links</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <FieldLabel htmlFor="bp-social-instagram" hint="optional">Instagram</FieldLabel>
                <TextInput id="bp-social-instagram" value={social.instagram || ''} maxLength={60} onChange={e => patchSocial('instagram', e.target.value)} placeholder="@username" />
              </div>
              <div>
                <FieldLabel htmlFor="bp-social-twitter" hint="optional">X / Twitter</FieldLabel>
                <TextInput id="bp-social-twitter" value={social.twitter || ''} maxLength={60} onChange={e => patchSocial('twitter', e.target.value)} placeholder="@username" />
              </div>
              <div>
                <FieldLabel htmlFor="bp-social-tiktok" hint="optional">TikTok</FieldLabel>
                <TextInput id="bp-social-tiktok" value={social.tiktok || ''} maxLength={60} onChange={e => patchSocial('tiktok', e.target.value)} placeholder="@username" />
              </div>
              <div>
                <FieldLabel htmlFor="bp-social-other" hint="optional">Other</FieldLabel>
                <TextInput id="bp-social-other" value={social.other || ''} maxLength={60} onChange={e => patchSocial('other', e.target.value)} placeholder="Any other link" />
              </div>
            </div>
          </Card>

          <Card style={{ marginBottom: 16 }}>
            <SectionLabel>Generator defaults</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <FieldLabel htmlFor="bp-default-bio-format" hint="prefills the Bio Generator">Default bio format</FieldLabel>
                <Select id="bp-default-bio-format" value={bs.defaultBioFormat || ''} onChange={e => patchBrandSettings('defaultBioFormat', e.target.value)}>
                  <option value="">No default</option>
                  {BIO_FORMATS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                </Select>
              </div>
              <div>
                <FieldLabel htmlFor="bp-default-strategy" hint="prefills the Tip Menu Generator">Default tip-menu strategy</FieldLabel>
                <Select id="bp-default-strategy" value={bs.defaultTipMenuStrategy || ''} onChange={e => patchBrandSettings('defaultTipMenuStrategy', e.target.value)}>
                  <option value="">No default</option>
                  {PRICING_STRATEGIES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </Select>
              </div>
            </div>
          </Card>

          <Card>
            <SectionLabel>Notes</SectionLabel>
            <FieldLabel htmlFor="bp-notes" hint="optional — anything else your generators should know">Brand notes</FieldLabel>
            <TextArea id="bp-notes" value={bs.notes || ''} maxLength={2000} onChange={e => patchBrandSettings('notes', e.target.value)} placeholder="Anything else about your brand worth remembering" />
          </Card>

          <div style={{ marginTop: 20 }}>
            <PrimaryButton onClick={handleSave} disabled={saving || !profile?.displayName?.trim()}>
              {saving ? 'Saving…' : saved ? '✓ Saved' : '💾 Save brand profile'}
            </PrimaryButton>
            {!profile?.displayName?.trim() && <div style={{ fontSize: 12, color: T.faint, marginTop: 8 }}>Add a stage name to save.</div>}
          </div>
        </div>

        <GuidancePanel>
          Fill this out once — every generator in Brand Studio (starting with Bio and Tip Menu, with more on the way) automatically pulls from this profile so your bios, menus, and future content all sound consistently like you.
        </GuidancePanel>
      </div>
    </div>
  )
}
