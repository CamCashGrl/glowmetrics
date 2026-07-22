'use client'
import { useState, useMemo } from 'react'
import {
  T, Card, SectionLabel, FieldLabel, TextInput, Select, PillGroup, SingleSelectPills,
  PrimaryButton, SecondaryButton, StepDots, LoadingStaged, ErrorBanner, EmptyState, Badge, TextArea, Toggle,
  GuidancePanel, CompletionTracker, LiveSummaryPanel,
} from './theme'
import TipMenuEditor from './TipMenuEditor'
import {
  TIP_MENU_PLATFORMS, CURRENCY_TYPES, defaultTokenValue, PERSONA_TAGS, SHOW_ENERGY_OPTIONS,
  ROOM_GOAL_OPTIONS, COMFORT_LEVELS, TIP_MENU_CATEGORIES, PRICING_STRATEGIES, MENU_ITEM_COUNTS,
  MENU_STYLES, TIP_MENU_LOADING_MESSAGES,
} from '../../../../lib/profileStudio/constants'
import { track } from '../../../../lib/track'

const STEPS = ['Platform', 'Style', 'Categories', 'Boundaries', 'Pricing']

const WHY_TEXT = [
  'Your platform and token value determine the correct payout math so estimated earnings are accurate, not guessed.',
  'Your persona and show energy control the wording and category emphasis of every generated item.',
  'Only the categories you enable are used — nothing outside your selection is suggested.',
  'Boundaries and intensity limits are enforced before any item is ever generated.',
  'Your strategy, price range, and item count determine the deterministic pricing curve — the AI never invents a price.',
]

function TagInput({ value, onChange, placeholder, ariaLabel }) {
  const [text, setText] = useState('')
  return (
    <div>
      <TextInput
        aria-label={ariaLabel || placeholder}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && text.trim()) {
            e.preventDefault()
            onChange([...value, text.trim()])
            setText('')
          }
        }}
        placeholder={placeholder}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        {value.map((item, i) => (
          <Badge key={i} color={T.pink}>
            {item}{' '}
            <button onClick={() => onChange(value.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', marginLeft: 4 }}>✕</button>
          </Badge>
        ))}
      </div>
    </div>
  )
}

export default function TipMenuGenerator({ isLoggedIn, sharedProfile, onSharedProfileChange }) {
  const [step, setStep] = useState(0)

  const [platform, setPlatform] = useState(sharedProfile?.platforms?.[0] || 'Chaturbate')
  const [currencyType, setCurrencyType] = useState('tokens')
  const [tokenValue, setTokenValue] = useState(defaultTokenValue(sharedProfile?.platforms?.[0] || 'Chaturbate'))
  const [privateShowPrice, setPrivateShowPrice] = useState('')
  const [averageTip, setAverageTip] = useState('')
  const [earningsGoalPerHour, setEarningsGoalPerHour] = useState('')

  const [persona, setPersona] = useState(sharedProfile?.personaTags || [])
  const [showEnergy, setShowEnergy] = useState('Playful')
  const [roomGoal, setRoomGoal] = useState('More small tips')
  const [comfortLevel, setComfortLevel] = useState('moderate')

  const [categories, setCategories] = useState(
    sharedProfile?.tipMenuCategories?.length ? sharedProfile.tipMenuCategories : TIP_MENU_CATEGORIES.slice(0, 8)
  )
  const [customCategories, setCustomCategories] = useState([])
  const [customCategoryText, setCustomCategoryText] = useState('')

  const [neverInclude, setNeverInclude] = useState([])
  const [privateOnly, setPrivateOnly] = useState([])
  const [amountGated, setAmountGated] = useState([])
  const [requireApproval, setRequireApproval] = useState(true)
  const [maxIntensity, setMaxIntensity] = useState('moderate')
  const [countdownsAllowed, setCountdownsAllowed] = useState(true)
  const [tipsStack, setTipsStack] = useState(true)
  const [oneUserControl, setOneUserControl] = useState(false)
  const [refundable, setRefundable] = useState(false)
  const [disclaimer, setDisclaimer] = useState('')

  const [strategy, setStrategy] = useState('balanced')
  const [minPrice, setMinPrice] = useState(10)
  const [maxPrice, setMaxPrice] = useState(500)
  const [itemCount, setItemCount] = useState(20)
  const [hideEarningsFromCustomer, setHideEarningsFromCustomer] = useState(false)
  const [selectedStyles, setSelectedStyles] = useState(['balanced', 'high_engagement', 'premium'])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [menus, setMenus] = useState(null)
  const [activeStyle, setActiveStyle] = useState('balanced')

  const earningsPreview = useMemo(() => {
    const sample = 100
    const est = currencyType === 'dollars' ? sample : sample * tokenValue
    return `100 ${currencyType === 'dollars' ? 'dollars' : currencyType} = approximately $${est.toFixed(2)} creator earnings`
  }, [tokenValue, currencyType])

  const toggleCategory = id => setCategories(c => (c.includes(id) ? c.filter(x => x !== id) : [...c, id]))
  const toggleStyle = id => setSelectedStyles(s => {
    if (s.includes(id)) return s.filter(x => x !== id)
    if (s.length >= 3) return s
    return [...s, id]
  })

  const goNext = () => setStep(s => Math.min(s + 1, STEPS.length - 1))
  const goBack = () => setStep(s => Math.max(s - 1, 0))

  const handleGenerate = async () => {
    setError('')
    setLoading(true)
    setMenus(null)
    track('generate_clicked', { type: 'tipmenu', styles: selectedStyles })
    onSharedProfileChange?.({
      platforms: sharedProfile?.platforms?.length ? sharedProfile.platforms : [platform],
      personaTags: persona,
      pricingPreferences: { platform, currencyType, tokenValue, strategy, minPrice, maxPrice },
      tipMenuCategories: categories,
    })
    try {
      const res = await fetch('/api/profile-studio/tip-menu/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform, currencyType, tokenValue,
          privateShowPrice: privateShowPrice === '' ? undefined : Number(privateShowPrice),
          averageTip: averageTip === '' ? undefined : Number(averageTip),
          earningsGoalPerHour: earningsGoalPerHour === '' ? undefined : Number(earningsGoalPerHour),
          persona, showEnergy, roomGoal, comfortLevel,
          categories, customCategories,
          boundaries: { neverInclude, privateOnly, amountGated, requireApproval, maxIntensity, countdownsAllowed, tipsStack, oneUserControl, refundable, disclaimer },
          strategy, minPrice: Number(minPrice), maxPrice: Number(maxPrice), itemCount,
          styles: selectedStyles, hideEarningsFromCustomer,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.')
        track('generation_failed', { type: 'tipmenu' })
        return
      }
      setMenus(data.menus)
      setActiveStyle(data.menus[0]?.style || 'balanced')
      track('generation_succeeded', { type: 'tipmenu', styles: selectedStyles })
    } catch {
      setError('Network error. Please check your connection and try again.')
      track('generation_failed', { type: 'tipmenu' })
    } finally {
      setLoading(false)
    }
  }

  const activeMenu = menus?.find(m => m.style === activeStyle) || menus?.[0]

  const checklist = [
    { label: 'Platform format', done: !!platform },
    { label: 'Brand voice', done: persona.length > 0 },
    { label: 'Categories', done: categories.length > 0 },
    { label: 'Boundaries', done: neverInclude.length > 0 || !!disclaimer.trim() },
    { label: 'Pricing range', done: Number(minPrice) > 0 && Number(maxPrice) > Number(minPrice) },
    { label: 'Room goal', done: !!roomGoal },
    { label: 'Comfort level', done: !!comfortLevel },
    { label: 'Item count', done: !!itemCount },
  ]
  const completionPercent = Math.round((checklist.filter(c => c.done).length / checklist.length) * 100)

  const summaryRows = [
    { label: 'Platform', value: platform },
    { label: 'Creator payout value', value: `${tokenValue} ${currencyType === 'dollars' ? '' : `(${currencyType})`}`.trim() },
    { label: 'Menu type(s)', value: selectedStyles.map(id => MENU_STYLES.find(s => s.id === id)?.label).filter(Boolean).join(', ') },
    { label: 'Item count', value: itemCount ? String(itemCount) : '' },
    { label: 'Pricing strategy', value: PRICING_STRATEGIES.find(s => s.id === strategy)?.label },
    { label: 'Min / max price', value: `${minPrice} – ${maxPrice}` },
    { label: 'Main goal', value: roomGoal },
    { label: 'Custom request policy', value: requireApproval ? 'Requires approval' : 'No approval needed' },
    { label: 'Public/private', value: privateOnly.length ? `${privateOnly.length} private-only` : 'All public by default' },
  ]

  return (
    <div>
      <StepDots steps={STEPS} current={step} />
      <CompletionTracker percent={completionPercent} checklist={checklist} />
      <ErrorBanner message={error} onDismiss={() => setError('')} />

      {step === 0 && (
      <div className="ps-wizard-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 20, alignItems: 'start' }}>
        <Card className="ps-fade">
          <SectionLabel>Step 1 · Platform and token value</SectionLabel>
          <div className="ps-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <FieldLabel htmlFor="tm-platform">Platform</FieldLabel>
              <Select id="tm-platform" value={platform} onChange={e => { setPlatform(e.target.value); setTokenValue(defaultTokenValue(e.target.value)) }}>
                {TIP_MENU_PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </Select>
            </div>
            <div>
              <FieldLabel htmlFor="tm-currency">Currency type</FieldLabel>
              <Select id="tm-currency" value={currencyType} onChange={e => setCurrencyType(e.target.value)}>
                {CURRENCY_TYPES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </Select>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <FieldLabel htmlFor="tm-token-value" hint="editable — platform default is prefilled">Token-to-dollar value</FieldLabel>
            <TextInput id="tm-token-value" type="number" step="0.001" min="0" style={{ maxWidth: 200 }} value={tokenValue} onChange={e => setTokenValue(Number(e.target.value) || 0)} />
            <div style={{ fontSize: 12.5, color: T.cyan, marginTop: 8, fontWeight: 600 }}>{earningsPreview}</div>
            <div style={{ fontSize: 11.5, color: T.faint, marginTop: 4 }}>Estimates depend on your platform and payout settings — use this as a guide, not a guarantee.</div>
          </div>

          <div className="ps-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 16 }}>
            <div>
              <FieldLabel htmlFor="tm-private-show" hint="optional">Private show price</FieldLabel>
              <TextInput id="tm-private-show" type="number" min="0" value={privateShowPrice} onChange={e => setPrivateShowPrice(e.target.value)} />
            </div>
            <div>
              <FieldLabel htmlFor="tm-average-tip" hint="optional">Average tip size</FieldLabel>
              <TextInput id="tm-average-tip" type="number" min="0" value={averageTip} onChange={e => setAverageTip(e.target.value)} />
            </div>
            <div>
              <FieldLabel htmlFor="tm-goal-hour" hint="optional, $/hr">Earnings goal per hour</FieldLabel>
              <TextInput id="tm-goal-hour" type="number" min="0" value={earningsGoalPerHour} onChange={e => setEarningsGoalPerHour(e.target.value)} />
            </div>
          </div>
        </Card>
        <GuidancePanel>{WHY_TEXT[0]}</GuidancePanel>
        <LiveSummaryPanel title="Your Menu Strategy" rows={summaryRows} />
      </div>
      )}

      {step === 1 && (
      <div className="ps-wizard-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 20, alignItems: 'start' }}>
        <Card className="ps-fade">
          <SectionLabel>Step 2 · Creator style</SectionLabel>
          <FieldLabel>Main persona</FieldLabel>
          <PillGroup options={PERSONA_TAGS} value={persona} onToggle={id => setPersona(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]))} />

          <div style={{ marginTop: 16 }}>
            <FieldLabel>Show energy</FieldLabel>
            <SingleSelectPills options={SHOW_ENERGY_OPTIONS} value={showEnergy} onChange={setShowEnergy} />
          </div>

          <div style={{ marginTop: 16 }}>
            <FieldLabel>Main room goal</FieldLabel>
            <SingleSelectPills options={ROOM_GOAL_OPTIONS} value={roomGoal} onChange={setRoomGoal} />
          </div>

          <div style={{ marginTop: 16 }}>
            <FieldLabel>Comfort level</FieldLabel>
            <SingleSelectPills options={COMFORT_LEVELS} value={comfortLevel} onChange={setComfortLevel} />
          </div>
        </Card>
        <GuidancePanel>{WHY_TEXT[1]}</GuidancePanel>
        <LiveSummaryPanel title="Your Menu Strategy" rows={summaryRows} />
      </div>
      )}

      {step === 2 && (
      <div className="ps-wizard-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 20, alignItems: 'start' }}>
        <Card className="ps-fade">
          <SectionLabel>Step 3 · Menu categories</SectionLabel>
          <p style={{ fontSize: 13, color: T.muted, marginBottom: 12 }}>Enable the categories that fit your show — nude or non-nude, it's your call.</p>
          <PillGroup options={TIP_MENU_CATEGORIES} value={categories} onToggle={toggleCategory} />

          <div style={{ marginTop: 20 }}>
            <FieldLabel htmlFor="tm-custom-category" hint="press Enter to add">Creator-defined category</FieldLabel>
            <TextInput
              id="tm-custom-category"
              value={customCategoryText}
              onChange={e => setCustomCategoryText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && customCategoryText.trim()) {
                  e.preventDefault()
                  setCustomCategories(c => [...c, customCategoryText.trim()])
                  setCustomCategoryText('')
                }
              }}
              placeholder="Add your own category"
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {customCategories.map((c, i) => (
                <Badge key={i} color={T.gold}>
                  {c}{' '}
                  <button onClick={() => setCustomCategories(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', marginLeft: 4 }}>✕</button>
                </Badge>
              ))}
            </div>
          </div>
        </Card>
        <GuidancePanel>{WHY_TEXT[2]}</GuidancePanel>
        <LiveSummaryPanel title="Your Menu Strategy" rows={summaryRows} />
      </div>
      )}

      {step === 3 && (
      <div className="ps-wizard-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 20, alignItems: 'start' }}>
        <Card className="ps-fade">
          <SectionLabel>Step 4 · Boundaries and exclusions</SectionLabel>
          <FieldLabel hint="never suggested in your menu">Activities never to include</FieldLabel>
          <TagInput value={neverInclude} onChange={setNeverInclude} placeholder="Type a boundary and press Enter" ariaLabel="Activities never to include" />

          <div style={{ marginTop: 16 }}>
            <FieldLabel hint="optional">Activities allowed only in private</FieldLabel>
            <TagInput value={privateOnly} onChange={setPrivateOnly} placeholder="Type an activity and press Enter" ariaLabel="Activities allowed only in private" />
          </div>

          <div style={{ marginTop: 16 }}>
            <FieldLabel hint="optional">Activities allowed only at certain tip amounts</FieldLabel>
            <TagInput value={amountGated} onChange={setAmountGated} placeholder="Type an activity and press Enter" ariaLabel="Activities allowed only at certain tip amounts" />
          </div>

          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Toggle checked={requireApproval} onChange={setRequireApproval} label="Custom requests require approval" />
            <Toggle checked={countdownsAllowed} onChange={setCountdownsAllowed} label="Countdowns are allowed" />
            <Toggle checked={tipsStack} onChange={setTipsStack} label="Repeated tips stack" />
            <Toggle checked={oneUserControl} onChange={setOneUserControl} label="One user can control an activity" />
            <Toggle checked={refundable} onChange={setRefundable} label="Tips are refundable" />
          </div>

          <div style={{ marginTop: 16 }}>
            <FieldLabel>Maximum intensity level</FieldLabel>
            <SingleSelectPills options={[{ id: 'mild', label: 'Mild' }, { id: 'moderate', label: 'Moderate' }, { id: 'high', label: 'High' }]} value={maxIntensity} onChange={setMaxIntensity} />
          </div>

          <div style={{ marginTop: 16 }}>
            <FieldLabel htmlFor="tm-disclaimer" hint="optional">Menu disclaimer</FieldLabel>
            <TextArea id="tm-disclaimer" value={disclaimer} maxLength={300} onChange={e => setDisclaimer(e.target.value)} placeholder="e.g. All custom requests are reviewed before approval." />
          </div>
        </Card>
        <GuidancePanel>{WHY_TEXT[3]}</GuidancePanel>
        <LiveSummaryPanel title="Your Menu Strategy" rows={summaryRows} />
      </div>
      )}

      {step === 4 && (
      <div className="ps-wizard-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 20, alignItems: 'start' }}>
        <Card className="ps-fade">
          <SectionLabel>Step 5 · Pricing strategy</SectionLabel>
          <FieldLabel>Strategy</FieldLabel>
          <SingleSelectPills options={PRICING_STRATEGIES} value={strategy} onChange={setStrategy} />

          <div className="ps-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
            <div>
              <FieldLabel htmlFor="tm-min-price">Minimum menu price</FieldLabel>
              <TextInput id="tm-min-price" type="number" min="1" value={minPrice} onChange={e => setMinPrice(e.target.value)} />
            </div>
            <div>
              <FieldLabel htmlFor="tm-max-price">Maximum menu price</FieldLabel>
              <TextInput id="tm-max-price" type="number" min="1" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} />
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <FieldLabel>Number of items</FieldLabel>
            <SingleSelectPills
              options={MENU_ITEM_COUNTS.map(n => ({ id: n, label: String(n) }))}
              value={itemCount}
              onChange={v => setItemCount(Number(v))}
            />
          </div>

          <div style={{ marginTop: 16 }}>
            <Toggle checked={hideEarningsFromCustomer} onChange={setHideEarningsFromCustomer} label="Hide estimated earnings from the customer-facing version" />
          </div>

          <div style={{ marginTop: 20 }}>
            <FieldLabel hint="pick up to 3 — each generates its own editable menu">Menu type</FieldLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
              {MENU_STYLES.map(s => {
                const active = selectedStyles.includes(s.id)
                const disabled = !active && selectedStyles.length >= 3
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleStyle(s.id)}
                    disabled={disabled}
                    className="ps-btn"
                    style={{
                      textAlign: 'left', padding: '10px 12px', borderRadius: 12, cursor: disabled ? 'not-allowed' : 'pointer',
                      border: `1px solid ${active ? 'rgba(22,244,255,0.7)' : T.border}`,
                      background: active ? 'rgba(22,244,255,0.12)' : 'rgba(255,255,255,0.03)',
                      opacity: disabled ? 0.4 : 1,
                    }}
                  >
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: active ? T.white : T.soft }}>{active ? '✓ ' : ''}{s.label}</div>
                    <div style={{ fontSize: 11, color: T.faint, marginTop: 2, lineHeight: 1.4 }}>{s.desc}</div>
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{ marginTop: 22 }}>
            <PrimaryButton onClick={handleGenerate} disabled={loading || !categories.length || !selectedStyles.length}>
              {loading ? 'Generating…' : '✨ Generate my tip menu'}
            </PrimaryButton>
            {!categories.length && <div style={{ fontSize: 12, color: T.faint, marginTop: 8 }}>Enable at least one category in Step 3.</div>}
            {!selectedStyles.length && <div style={{ fontSize: 12, color: T.faint, marginTop: 8 }}>Pick at least one menu type above.</div>}
          </div>
        </Card>
        <GuidancePanel>{WHY_TEXT[4]}</GuidancePanel>
        <LiveSummaryPanel title="Your Menu Strategy" rows={summaryRows} />
      </div>
      )}

      {step < 4 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18 }}>
          <SecondaryButton onClick={goBack} disabled={step === 0}>← Back</SecondaryButton>
          <PrimaryButton onClick={goNext}>Continue →</PrimaryButton>
        </div>
      )}
      {step === 4 && (
        <div style={{ marginTop: 12 }}>
          <SecondaryButton onClick={goBack}>← Back</SecondaryButton>
        </div>
      )}

      <LoadingStaged messages={TIP_MENU_LOADING_MESSAGES} active={loading} />

      {!loading && menus && activeMenu && (
        <div className="ps-fade" style={{ marginTop: 28 }}>
          {!isLoggedIn && (
            <div style={{ marginBottom: 18, fontSize: 12.5, color: T.cyan, background: 'rgba(22,244,255,0.08)', border: '1px solid rgba(22,244,255,0.25)', borderRadius: 10, padding: '10px 14px' }}>
              💡 Editing and every export are free right now. <a href="/landing" style={{ color: T.cyan, fontWeight: 700 }}>Sign up free</a> to save this menu and reopen it later from your drafts.
            </div>
          )}
          {menus.length > 1 && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
              {menus.map(m => (
                <button
                  key={m.style}
                  onClick={() => setActiveStyle(m.style)}
                  className="ps-btn"
                  style={{
                    padding: '9px 18px', borderRadius: 12, cursor: 'pointer', fontWeight: 700, fontSize: 13,
                    border: `1px solid ${activeStyle === m.style ? 'rgba(22,244,255,0.7)' : T.border}`,
                    background: activeStyle === m.style ? 'rgba(22,244,255,0.14)' : 'rgba(255,255,255,0.03)',
                    color: activeStyle === m.style ? T.white : T.muted,
                  }}
                >
                  {MENU_STYLES.find(s => s.id === m.style)?.label || m.style}
                </button>
              ))}
            </div>
          )}
          <TipMenuEditor menu={activeMenu} isLoggedIn={isLoggedIn} onMenuUpdated={updated => setMenus(prev => prev.map(m => (m.id === updated.id ? { ...m, ...updated } : m)))} />

          <div style={{ borderRadius: 16, border: '1px solid rgba(255,43,174,0.25)', background: 'rgba(255,43,174,0.06)', padding: 24, marginTop: 24 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 16 }}>
              <img src="/blog-images/spin_the_wheel_cover.png" alt="Spin-the-Wheel Template Pack for cam models cover art by Pretty Profitz" style={{ width: 140, borderRadius: 10, display: 'block' }} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: T.white, margin: '0 0 8px', textAlign: 'center' }}>Want a designed, printable version of this menu?</div>
            <p style={{ fontSize: 14, color: T.muted, margin: '0 0 16px', lineHeight: 1.6, textAlign: 'center' }}>
              Pretty Profitz sells ready-made tip menu templates (320+ styles to choose from), a Roll-the-Dice game template, and the Spin-the-Wheel Template Pack — all editable and Etsy-instant-download.
            </p>
            <p style={{ fontSize: 14, color: T.muted, margin: '0 0 18px', lineHeight: 1.6, textAlign: 'center' }}>
              Use code <strong style={{ color: T.white }}>PRETTY70</strong> at checkout for 70% off.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href="https://prettyprofitz.etsy.com" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', background: 'linear-gradient(90deg,#16F4FF,#7C5CFF,#FF2BAE)', color: '#050713', padding: '11px 22px', borderRadius: 10, fontWeight: 800, fontSize: 14, textDecoration: 'none' }}>Shop tip menus & templates on Etsy →</a>
            </div>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginTop: 18, fontSize: 12.5 }}>
              <a href="/guides/cam-model-room-title-generator" style={{ color: T.cyan, textDecoration: 'none' }}>→ Free cam room title generator</a>
              <a href="/blog/viral-cam-room-titles" style={{ color: T.cyan, textDecoration: 'none' }}>→ Viral cam room titles</a>
              <a href="/blog/best-cam-model-tools" style={{ color: T.cyan, textDecoration: 'none' }}>→ Best cam model tools</a>
              <a href="/landing" style={{ color: T.cyan, textDecoration: 'none' }}>→ Track your real tip earnings on CamCash</a>
            </div>
          </div>
        </div>
      )}

      {!menus && !loading && step === 4 && (
        <EmptyState title="Create a menu designed around your show style, boundaries, and income goals." description="Set your platform, categories, boundaries, and pricing strategy, then generate an editable tip menu." />
      )}
    </div>
  )
}
