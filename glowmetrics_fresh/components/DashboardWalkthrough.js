'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Button from './ui/Button'

const WALKTHROUGH_KEY = 'camcash_walkthrough_done'

const STEPS = [
  {
    id: 'welcome',
    title: '👋 Welcome to CamCash!',
    description: "You're in! This is your analytics dashboard — built specifically for cam models. Let's take a 60-second tour so you know exactly where everything is.",
    tabId: null,
    position: 'center',
  },
  {
    id: 'upload',
    title: '📥 Start Here — Import Your Data',
    description: 'Click Import in the sidebar to upload your CSV files from Chaturbate, BongaCams, or MyFreeCams. Once uploaded, your entire dashboard fills with real data instantly.',
    tabId: 'upload',
    position: 'sidebar',
  },
  {
    id: 'overview',
    title: '📊 Overview — Your Earnings at a Glance',
    description: 'See your total earnings, tips, sessions, and platform breakdown all in one place. Your full financial snapshot the moment you log in.',
    tabId: 'overview',
    position: 'sidebar',
  },
  {
    id: 'platforms',
    title: '🎯 Platforms — Compare Your Income Sources',
    description: 'Break down your earnings by platform — Chaturbate, BongaCams, MFC. See which platform is actually making you the most money.',
    tabId: 'platforms',
    position: 'sidebar',
  },
  {
    id: 'whales',
    title: '🐳 Top Fans — Know Your Biggest Tippers',
    description: "See exactly who your whales are, how much they've spent, and when they last showed up. Use this to re-engage fans who've gone quiet before they disappear.",
    tabId: 'whales',
    position: 'sidebar',
  },
  {
    id: 'sessions',
    title: '🎥 Sessions — Every Stream Breakdown',
    description: "See every stream you've recorded — duration, earnings, platform, and tip timeline. Instantly spot which sessions made the most and why.",
    tabId: 'sessions',
    position: 'sidebar',
  },
  {
    id: 'titles',
    title: '🎬 Room Titles — Go Viral',
    description: 'Generate high-converting room titles with one click. Customize your goal, toy, game mode, emojis, and hashtags — then copy and go live.',
    tabId: 'titles',
    position: 'sidebar',
  },
  {
    id: 'help',
    title: '❓ CSV Help — Stuck on Importing?',
    description: 'Not sure how to export your CSV from Chaturbate or BongaCams? This tab walks you through it step by step for every platform.',
    tabId: 'help',
    position: 'sidebar',
  },
  {
    id: 'done',
    title: "🚀 You're All Set!",
    description: "That's the full tour! Start by clicking Import and uploading your first CSV — it only takes a minute and your dashboard comes alive instantly. You've got this 💜",
    tabId: null,
    position: 'center',
  },
]

export default function DashboardWalkthrough({ onTabChange }) {
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  useEffect(() => {
    const checkShouldShow = async () => {
      if (localStorage.getItem(WALKTHROUGH_KEY)) return
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { count } = await supabase
        .from('tips')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
      if (count === 0) setTimeout(() => setVisible(true), 1000)
    }
    checkShouldShow()
  }, [])

  useEffect(() => {
    if (!visible) return
    const current = STEPS[step]
    if (current.tabId && onTabChange) onTabChange(current.tabId)
  }, [step, visible])

  const handleNext = () => step < STEPS.length - 1 ? setStep(s => s + 1) : handleDone()
  const handleBack = () => step > 0 && setStep(s => s - 1)

  const handleDone = () => {
    localStorage.setItem(WALKTHROUGH_KEY, 'true')
    setVisible(false)
    if (onTabChange) onTabChange('overview')
  }

  const handleSkip = () => {
    localStorage.setItem(WALKTHROUGH_KEY, 'true')
    setVisible(false)
    if (onTabChange) onTabChange('overview')
  }

  if (!visible) return null

  const current = STEPS[step]
  const isCenter = current.position === 'center'
  const isLast = step === STEPS.length - 1
  const isFirst = step === 0

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9998, pointerEvents: 'none' }} />

      {!isCenter && (
        <div style={{
          position: 'fixed', left: 0, top: 0, bottom: 0, width: 240,
          boxShadow: '0 0 0 3px rgba(168,85,247,0.6) inset',
          zIndex: 9999, pointerEvents: 'none', transition: 'all 0.3s ease',
        }} />
      )}

      <div style={{
        position: 'fixed',
        zIndex: 10000,
        ...(isCenter
          ? { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 'min(440px, 90vw)' }
          : { top: '50%', left: 260, transform: 'translateY(-50%)', width: 'min(340px, 85vw)' }
        ),
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
        border: '1px solid rgba(168,85,247,0.45)',
        borderRadius: 16, padding: 24,
        boxShadow: '0 25px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(168,85,247,0.2)',
      }}>
        <div style={{ display: 'flex', gap: 5, marginBottom: 14 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 22 : 6, height: 6, borderRadius: 3,
              background: i === step ? '#a855f7' : i < step ? '#6d28d9' : 'rgba(255,255,255,0.12)',
              transition: 'all 0.3s ease',
            }} />
          ))}
        </div>

        <div style={{ fontSize: 10, color: '#a855f7', fontWeight: 700, marginBottom: 6, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Step {step + 1} of {STEPS.length}
        </div>

        <h3 style={{ margin: '0 0 10px', fontSize: 17, fontWeight: 700, color: '#f1f5f9', lineHeight: 1.3 }}>
          {current.title}
        </h3>

        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#94a3b8', lineHeight: 1.65 }}>
          {current.description}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={handleSkip} style={{ background: 'transparent', border: 'none', color: '#475569', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>
            Skip tour
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {!isFirst && (
              <button onClick={handleBack} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', padding: '8px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
                Back
              </button>
            )}
            <Button onClick={handleNext} style={{ padding: '8px 18px', fontSize: 13 }}>
              {isLast ? "Let's go! 🚀" : 'Next →'}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
