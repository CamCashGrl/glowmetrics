import TitleGeneratorClient from './TitleGeneratorClient'

export const metadata = {
  title: 'Free Cam Room Title Generator + Hashtag Generator (2026)',
  description: 'Generate room titles and hashtags that increase clicks, tips, and viewer engagement. Free tool for cam models on Chaturbate, BongaCams, MyFreeCams, and Stripchat — no signup required.',
  keywords: 'cam room title generator, room title generator, cam model hashtags, cam hashtags, stream title generator, creator hashtags, cam model title ideas, live stream title generator, chaturbate title generator, best room titles',
  openGraph: {
    title: 'Free Cam Room Title Generator + Hashtag Generator (2026)',
    description: 'Generate room titles and hashtags designed to increase clicks, tips, and viewer engagement. Free tool, no signup required.',
    type: 'website',
    url: 'https://camcashgrl.com/guides/chaturbate-room-title-generator',
    images: [{ url: 'https://camcashgrl.com/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free Cam Room Title Generator + Hashtag Generator',
    description: 'Generate high-converting titles and hashtags instantly. No signup needed.',
  },
  robots: {
    index: true, follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  alternates: { canonical: 'https://camcashgrl.com/guides/chaturbate-room-title-generator' },
}

export const viewport = { width: 'device-width', initialScale: 1, maximumScale: 5 }

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    { '@type': 'Question', name: 'What makes a good cam room title?', acceptedAnswer: { '@type': 'Answer', text: 'A good room title combines a specific goal, a clear reward, urgency, and personality. The most effective titles tell viewers exactly what will happen if they tip, and when. Specificity outperforms vagueness every time — "500 tokens = squirt show, last hour" beats "come hang and have fun" in clicks every time.' } },
    { '@type': 'Question', name: 'Do hashtags help cam models get more viewers?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. Hashtags help platforms categorize your stream and surface it to viewers browsing by category or interest. Using a mix of high-traffic, community, and niche hashtags gives your room the best discoverability across multiple audience segments.' } },
    { '@type': 'Question', name: 'How often should I change my room title?', acceptedAnswer: { '@type': 'Answer', text: 'Change your title every 2–3 streams minimum, and mid-stream if it\'s not working within the first 20 minutes. Think of your title as an A/B test — track which formats bring in more viewers and tips over time.' } },
    { '@type': 'Question', name: 'How many hashtags should I use?', acceptedAnswer: { '@type': 'Answer', text: 'Use 8–12 hashtags per stream. Too few limits discoverability. Too many looks spammy and dilutes signal. A good mix is 2 high-traffic tags, 3 community tags, 3 niche tags, and 2 experimental tags.' } },
    { '@type': 'Question', name: 'Can room titles increase tips?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. Titles that include a specific token goal and a clear reward have measurably higher tip rates than titles without goals. The reward needs to be believable and compelling — the more specific the reward, the higher the conversion rate.' } },
    { '@type': 'Question', name: 'What room titles get the most clicks?', acceptedAnswer: { '@type': 'Answer', text: 'Titles with urgency ("tonight only", "last hour", "this stream only"), clear interactive elements ("tip to control my Lush"), and specific goals consistently outperform generic titles. Including 1–2 emojis increases click-through rate by roughly 15–20%.' } },
    { '@type': 'Question', name: 'What hashtags work best for cam models?', acceptedAnswer: { '@type': 'Answer', text: 'The best hashtags combine breadth and depth. Start with high-traffic platform tags like #Chaturbate or #CamGirl, add community tags that signal stream type like #Lovense or #GoalShow, then layer niche tags that match your specific content or identity.' } },
    { '@type': 'Question', name: 'How long should a room title be?', acceptedAnswer: { '@type': 'Answer', text: '50–70 characters is the sweet spot. Over 80 characters gets cut off on mobile and in thumbnail views. Prioritize your goal and reward in the first 50 characters since that\'s what viewers see before clicking.' } },
    { '@type': 'Question', name: 'Do emojis help with room title clicks?', acceptedAnswer: { '@type': 'Answer', text: '1–2 strategically placed emojis increase click-through rate by 15–20%. They add visual contrast in crowded room listings. Avoid using more than 3 — it looks unprofessional and can get your title flagged by spam filters.' } },
    { '@type': 'Question', name: 'What is the best room title formula?', acceptedAnswer: { '@type': 'Answer', text: 'The highest-converting formula is: Goal + Reward + Urgency. Example: "500 tokens = full oil show 🔥 tonight only." Every element does work — the number creates specificity, the reward creates desire, and the urgency creates action.' } },
    { '@type': 'Question', name: 'Should I use my real goal in the title?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. Viewers who can see a real, achievable goal are far more likely to tip toward it than viewers who see a vague promise. Keep the goal realistic for your typical stream. Unachievable goals erode trust.' } },
    { '@type': 'Question', name: 'What is a tip menu and should it be in my title?', acceptedAnswer: { '@type': 'Answer', text: 'A tip menu lists actions viewers can unlock at specific token amounts. Mentioning "tip menu open" or "tip menu active" in your title signals to experienced tippers that your room is interactive and reward-based, which attracts this audience segment.' } },
    { '@type': 'Question', name: 'How much do room titles affect click-through rate?', acceptedAnswer: { '@type': 'Answer', text: 'A strong, specific title can increase click-through rate by 40–60% compared to a generic one. In competitive room listings, your title is often the only differentiator between your room and a dozen others showing the same thumbnail size.' } },
    { '@type': 'Question', name: 'What titles work for interactive toy streams?', acceptedAnswer: { '@type': 'Answer', text: 'Interactive toy titles that perform best communicate control and immediacy: "tip to control my Lush ⚡", "every tip I feel it", "Lush on and reacting to everything." Combine this with a countdown goal to drive tip volume.' } },
    { '@type': 'Question', name: 'Is this room title generator free?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. The cam room title generator and hashtag generator on this page are completely free to use with no account required. Generate as many titles and hashtag sets as you need.' } },
    { '@type': 'Question', name: 'Can I use these titles on platforms other than Chaturbate?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. The titles generated here work across Chaturbate, BongaCams, MyFreeCams, Stripchat, and most other cam platforms. Token amounts and platform-specific terminology may vary, but the formulas are universal.' } },
  ],
}

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://camcashgrl.com' },
    { '@type': 'ListItem', position: 2, name: 'Guides', item: 'https://camcashgrl.com/guides' },
    { '@type': 'ListItem', position: 3, name: 'Cam Room Title Generator', item: 'https://camcashgrl.com/guides/chaturbate-room-title-generator' },
  ],
}

const appSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Cam Room Title Generator',
  applicationCategory: 'UtilityApplication',
  operatingSystem: 'Web',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.9', ratingCount: '218' },
  description: 'Free room title generator and hashtag generator for cam models on Chaturbate, BongaCams, MyFreeCams, and Stripchat.',
}

// ─── Style constants ──────────────────────────────────────────────────────────
const S = {
  bg:       '#14171C',
  surface:  '#1C2028',
  card:     '#21262F',
  border:   'rgba(255,255,255,0.07)',
  text:     '#8B92A0',
  textMid:  '#C1C7D4',
  textStrong:'#F0F2F6',
  accent:   '#6366F1',
  accentSoft:'rgba(99,102,241,0.12)',
  green:    '#10B981',
  gold:     '#F59E0B',
  pink:     '#EC4899',
  red:      '#EF4444',
  cyan:     '#22D3EE',
}

function Section({ id, children, style }) {
  return (
    <section id={id} style={{ padding: '64px 0', borderBottom: `1px solid ${S.border}`, ...style }}>
      {children}
    </section>
  )
}

function H2({ children }) {
  return (
    <h2 style={{
      fontSize: 'clamp(22px, 3.5vw, 30px)', fontWeight: 800, color: S.textStrong,
      margin: '0 0 12px', letterSpacing: '-0.03em', lineHeight: 1.25,
    }}>{children}</h2>
  )
}

function Lead({ children }) {
  return <p style={{ fontSize: '16px', color: S.textMid, lineHeight: 1.7, margin: '0 0 32px', maxWidth: '680px' }}>{children}</p>
}

function Tag({ color, children }) {
  return (
    <span style={{
      fontSize: '11px', fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase',
      color: color || S.accent, background: `${color || S.accent}18`,
      padding: '3px 8px', borderRadius: '5px', marginBottom: '10px', display: 'inline-block',
    }}>{children}</span>
  )
}

const TITLE_EXAMPLES = {
  'Beginner Streams': [
    "New here 🌸 still learning — tip to say hi! Goal: 200 = dance",
    "First week streaming 💜 goal: 150 tokens = take a request",
    "Learning the ropes 🎀 tips welcome — 100 = shoutout",
    "Shy but curious 👀 help me hit 300 for my first goal",
    "Just started — tip me into confidence 💜 goal at 200",
    "Day 3 of streaming 🌸 every tip helps — 200 = special moment",
  ],
  'Lovense / Interactive Toy': [
    "🎮 Lush ON — tip to control me | goal 500 = I lose control",
    "Every tip I feel ⚡ Lush reacting to EVERYTHING tonight",
    "Lush at full power 🔴 your tokens = my reactions — goal 1000",
    "tip to control my Domi 😈 I do what you say at 500 tokens",
    "🎮 interactive night — Lush on, tip menu open, goal: 300",
    "Hush in 😏 tip to activate — I can't hide my reactions",
    "Edge toy reacting to every token ⚡ goal: 400 = full power",
  ],
  'Goal Streams': [
    "500 tokens → oil show 🔥 tonight only — we're almost there",
    "Goal: 1000 = [full show] | top tipper picks everything 👑",
    "300 token goal active 💜 reward unlocks when we hit it",
    "Countdown: 200 away from goal 🎯 let's finish this together",
    "Last 100 tokens needed 🔥 help me reach goal before midnight",
    "Goal: 750 = lingerie strip | 2nd goal = even more 😈",
    "Building to 1000 ⚡ every 100 = mini reward on the way",
  ],
  'Couple Streams': [
    "Couples night 💑 goal: 500 = we both react | tip to control us",
    "Him vs me — viewer decides who tips more 😏 goal 300",
    "Surprise your fav couple 💜 500 tokens = you decide what we do",
    "We do everything together 🔥 tip to control both of us",
    "Couple goals: 1000 = full show | vote who leads 👑",
  ],
  'Cosplay Streams': [
    "🎮 Gamer girl tonight — tip to control my controller 😏",
    "Dressed up and dangerous 🌸 goal: 500 = character stays on",
    "Cosplay + Lovense = perfect combo ⚡ tip to see what happens",
    "In character all night 🎭 tip to make me break it 😈",
    "Fantasy stream tonight 🌟 goal: 400 = full reveal",
  ],
  'Feet Content': [
    "👣 Feet night — tip to see more | goal 300 = full show",
    "Close-up feet content 💜 every tip = new angle",
    "Feet + Lush = best combination 😏 goal 500",
    "Arch appreciation stream 🌸 tip to see what you want",
    "Barefoot and reacting 💦 goal 400 = oil show",
  ],
  'Alternative Models': [
    "Alt girl takeover 🖤 tip to control my vibrator tonight",
    "Goth + Lovense = dangerous combo 😈 goal 500",
    "Tattooed and reactive ⚡ every tip I feel it",
    "Dark vibes tonight 🌑 goal: 600 = show what's under",
    "Alt model + interactive toy 💜 tip menu open all night",
  ],
  'High Energy / Hype': [
    "WE ARE 200 AWAY FROM GOAL 🔥 let's FINISH this — tip NOW",
    "room is on fire tonight ⚡ tip to add to the chaos",
    "LAST HOUR — goal still open 😈 200 tokens left — let's go",
    "countdown is on 🎯 every tip gets a reaction — tip NOW",
    "ALMOST THERE 🔥 50 tokens to goal — someone be my hero",
  ],
}

const HASHTAG_CATEGORIES = {
  'High Traffic': ['#OnlyFans', '#Chaturbate', '#MyFreeCams', '#Stripchat', '#CamModel', '#CamGirl', '#AdultCreator', '#LiveStream', '#NSFWTwitter', '#AdultContent'],
  'Community': ['#Lovense', '#InteractiveShow', '#TipMenu', '#GoalShow', '#WheelGame', '#LiveTips', '#TokenGoal', '#TipControl', '#InteractiveToy'],
  'Niche': ['#Cosplay', '#TattooModel', '#FeetContent', '#AltModel', '#GamerGirl', '#CurvyModel', '#PetiteModel', '#MatureCreator', '#LatinaCam', '#AsianCam'],
  'Low Competition': ['#CamModelLife', '#ContentCreatorLife', '#NewCamModel', '#WeeklyCamGoals', '#TipForTip', '#StreamerLife'],
}

const HASHTAG_FORMULA_EXAMPLES = [
  {
    label: 'Interactive Toy Stream',
    tags: '#Chaturbate #Lovense #InteractiveShow #TipControl #GoalShow #CamGirl #GamerGirl #TipMenu #LiveStream #Cosplay',
  },
  {
    label: 'Goal Stream',
    tags: '#CamGirl #GoalShow #TokenGoal #TipMenu #Lovense #Chaturbate #LiveTips #CamModel #InteractiveToy #TipControl',
  },
  {
    label: 'Alt / Tattoo Model',
    tags: '#Chaturbate #CamModel #AltModel #TattooModel #Lovense #InteractiveShow #LiveStream #NSFWTwitter #CamGirl #TipMenu',
  },
  {
    label: 'Couples Stream',
    tags: '#Chaturbate #CamGirl #LiveStream #GoalShow #Lovense #TipControl #InteractiveShow #CamModel #NSFWTwitter #LiveTips',
  },
]

const MISTAKES = [
  { title: 'Being too generic', body: '"Just here to have fun" tells viewers nothing. Generic titles blend into the page — there\'s nothing to click on. Specificity is the entire game.' },
  { title: 'No reward in the title', body: 'If viewers can\'t see what they get for tipping, they won\'t tip. Always include the reward, even if it\'s vague: "tip = reaction" beats nothing.' },
  { title: 'No goal', body: 'Goals give the room momentum. Without a goal, there\'s no shared direction and no reason to tip urgently. Even a small goal creates action.' },
  { title: 'Too many emojis', body: '5+ emojis looks desperate and can trigger spam filters on some platforms. 1–2 targeted emojis are more effective than 6 random ones.' },
  { title: 'No call to action', body: '"Squirt show" is not a call to action. "500 tokens → squirt show" is. The token number + arrow + reward is the most powerful pattern in room titles.' },
  { title: 'Misleading viewers', body: 'Promising something in your title you won\'t deliver destroys trust fast. Your churn rate rises, your regulars disappear, and repeat visits drop permanently.' },
  { title: 'Updating too infrequently', body: 'A title from 3 weeks ago feels stale to returning viewers. Freshness signals activity — regular updates tell people something new is happening.' },
  { title: 'Ignoring mobile display', body: 'Over 60% of traffic is mobile. Titles over 80 characters get cut off. Put your most important information — goal and reward — in the first 50 characters.' },
]

const VIEWER_PSYCHOLOGY = [
  { icon: '🎯', title: 'Curiosity drives clicks', body: 'Titles that hint at something without fully revealing it generate more clicks. "You won\'t believe what happens at goal" outperforms a full description because curiosity is a more powerful motivator than information.' },
  { icon: '⏳', title: 'Urgency drives tips', body: '"Tonight only", "last hour", and "goal ends soon" are urgency signals that convert browsers into tippers. People tip more when they believe the window is closing.' },
  { icon: '🎮', title: 'Control drives engagement', body: 'Viewers who feel they have agency — "tip to control me", "you decide what happens" — stay longer and tip more. Interactive framing converts passive viewers into active participants.' },
  { icon: '🏆', title: 'Status drives big tips', body: 'Naming the top tipper, creating a VIP dynamic, or offering exclusive rewards for high tippers appeals to the competitive psychology that drives whale behavior.' },
  { icon: '📈', title: 'Progress drives momentum', body: 'Watching a goal counter move creates a completion drive. Announce how close you are to goal — "200 tokens away" is more motivating than "goal active".' },
  { icon: '🤝', title: 'Community drives loyalty', body: 'Using "we" instead of "I" ("let\'s hit 1000 together") frames tipping as a shared achievement. Regulars tip more when they feel they\'re part of a team.' },
]

export default function TitleGeneratorPage() {
  return (
    <>
      {/* JSON-LD Schemas */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(appSchema) }} />

      <div style={{ background: S.bg, minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', color: S.text }}>

        {/* ── Interactive tools (client) ─────────────────────────────────── */}
        <TitleGeneratorClient />

        {/* ── Static SEO content ────────────────────────────────────────── */}
        <div style={{ maxWidth: '860px', margin: '0 auto', padding: '0 20px' }}>

          {/* Table of Contents */}
          <Section id="toc" style={{ borderBottom: `1px solid ${S.border}`, paddingTop: '48px', paddingBottom: '40px' }}>
            <Tag>On this page</Tag>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '6px 24px', marginTop: '16px' }}>
              {[
                ['#viral-formula', 'The Viral Title Formula'],
                ['#title-examples', 'Room Title Examples by Category'],
                ['#title-frequency', 'How Often to Change Your Title'],
                ['#hashtag-guide', 'Best Hashtags for Cam Models'],
                ['#hashtag-formula', 'The Viral Hashtag Formula'],
                ['#mistakes', 'Common Title Mistakes to Avoid'],
                ['#viewer-psychology', 'How to Get More Viewers'],
                ['#faq', 'FAQ'],
                ['#tools', 'Related Creator Tools'],
              ].map(([href, label]) => (
                <a key={href} href={href} style={{
                  fontSize: '13px', color: S.text, textDecoration: 'none', padding: '5px 0',
                  borderBottom: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', gap: '6px',
                }}>
                  <span style={{ color: S.accent, fontSize: '10px' }}>→</span> {label}
                </a>
              ))}
            </div>
          </Section>

          {/* Section 4 — Viral Title Formula */}
          <Section id="viral-formula">
            <Tag color={S.accent}>Proven Formula</Tag>
            <H2>The Viral Room Title Formula</H2>
            <Lead>Every high-performing room title is built from the same core elements. Learn the formula, then customize it to your style and stream type.</Lead>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '40px' }}>
              {[
                { formula: 'Goal + Reward', example: '500 tokens → oil show 🔥 tonight only', why: 'The most fundamental pattern. A specific number removes ambiguity and a specific reward gives viewers a reason to act.' },
                { formula: 'Goal + Urgency', example: 'LAST HOUR — 300 tokens to goal 😈 don\'t miss it', why: 'Urgency converts browsers who are on the fence. Time pressure is one of the most reliable psychological triggers for action.' },
                { formula: 'Goal + Reward + Interactive Feature', example: '500 → squirt show ⚡ Lush ON — tip to control me', why: 'Stacking a goal with toy control appeals to both goal-oriented and control-oriented viewers simultaneously.' },
                { formula: 'Goal + Toy Trigger', example: 'Lush reacts to every tip 🔴 goal 400 = full power mode', why: 'Makes tipping feel immediate and personal — every token creates a visible response.' },
                { formula: 'Viewer Challenge', example: 'prove you want it 👑 top tipper controls everything — 500 wins', why: 'Competitive framing activates the viewer\'s desire for status and exclusivity, which drives high-value tips.' },
                { formula: 'Mystery + Goal', example: 'something big at 1000 tokens 👀 you won\'t believe it', why: 'Incomplete information creates curiosity. Curiosity drives clicks from viewers who might otherwise scroll past.' },
                { formula: 'Identity + Goal', example: 'shy girl 🌸 help me reach 300 for my first goal tonight', why: 'Relatable identity framing builds emotional connection, especially for newer models building an audience.' },
              ].map((item, i) => (
                <div key={i} style={{
                  background: S.card, border: `1px solid ${S.border}`, borderRadius: '10px',
                  padding: '18px 20px', borderLeft: `3px solid ${S.accent}`,
                }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: S.accent, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{item.formula}</div>
                  <div style={{ fontSize: '15px', color: S.textStrong, fontWeight: 600, marginBottom: '8px', lineHeight: 1.4 }}>"{item.example}"</div>
                  <div style={{ fontSize: '13px', color: S.text, lineHeight: 1.6 }}>{item.why}</div>
                </div>
              ))}
            </div>

            <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: '10px', padding: '20px 24px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: S.textStrong, marginBottom: '12px' }}>Quick formula reference</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                {['[Number] tokens → [reward]', '[reward] at [number] 🔥', 'tip to [action] | goal [number]', '[urgency] — [number] away from goal', 'tip = [instant reaction] 💦', 'you control [everything/toy] at [number]'].map((f, i) => (
                  <div key={i} style={{ fontSize: '12px', color: S.textMid, background: S.accentSoft, padding: '8px 12px', borderRadius: '7px', fontFamily: 'monospace' }}>{f}</div>
                ))}
              </div>
            </div>
          </Section>

          {/* Section 5 — Title Examples */}
          <Section id="title-examples">
            <Tag color={S.gold}>Examples</Tag>
            <H2>Room Title Examples by Category</H2>
            <Lead>Real examples across stream types. Copy, adapt, and test these for your own room.</Lead>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {Object.entries(TITLE_EXAMPLES).map(([category, titles]) => (
                <div key={category} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '10px', overflow: 'hidden' }}>
                  <div style={{ padding: '12px 18px', borderBottom: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: S.textStrong }}>{category}</span>
                  </div>
                  <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {titles.map((title, i) => (
                      <div key={i} style={{ fontSize: '13px', color: S.textMid, padding: '8px 10px', background: S.surface, borderRadius: '6px', lineHeight: 1.5, fontStyle: 'italic' }}>
                        "{title}"
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* Section 6 — How Often */}
          <Section id="title-frequency">
            <Tag color={S.cyan}>Strategy</Tag>
            <H2>How Often Should You Change Your Room Title?</H2>
            <Lead>Your room title is not a set-it-and-forget-it element. Think of it as an active testing variable — the models who improve fastest are the ones who treat their title like a hypothesis.</Lead>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginBottom: '32px' }}>
              {[
                { label: 'Change every 2–3 streams', desc: 'At minimum. Returning viewers notice stale titles. Freshness signals active engagement.' },
                { label: 'Change mid-stream if needed', desc: 'If your title isn\'t working after 20 minutes, change it. You\'re testing, not committing.' },
                { label: 'Test one variable at a time', desc: 'Change the goal OR the reward OR the urgency — not all three at once. That\'s how you learn what actually works.' },
                { label: 'Keep notes on what performs', desc: 'Write down which title formats brought more viewers in. Pattern recognition over 10+ streams reveals what your specific audience responds to.' },
              ].map((item, i) => (
                <div key={i} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '10px', padding: '16px 18px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: S.textStrong, marginBottom: '6px' }}>{item.label}</div>
                  <div style={{ fontSize: '13px', color: S.text, lineHeight: 1.6 }}>{item.desc}</div>
                </div>
              ))}
            </div>

            <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: '10px', padding: '20px 24px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: S.textStrong, marginBottom: '12px' }}>A/B testing your titles — example</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { version: 'Version A', title: '"come hang out 💜 goal active"', result: '14 viewers after 30 min' },
                  { version: 'Version B', title: '"500 tokens → oil show 🔥 tonight only"', result: '31 viewers after 30 min' },
                  { version: 'Version C', title: '"300 away from goal 🎯 tip to unlock — Lush ON"', result: '44 viewers after 30 min' },
                ].map((row, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: S.card, borderRadius: '7px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: S.accent, width: '72px', flexShrink: 0 }}>{row.version}</div>
                    <div style={{ flex: 1, fontSize: '13px', color: S.textMid, fontStyle: 'italic' }}>{row.title}</div>
                    <div style={{ fontSize: '12px', color: S.green, fontWeight: 600, flexShrink: 0 }}>{row.result}</div>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: '12px', color: S.text, marginTop: '12px', lineHeight: 1.6 }}>
                The same model, same time of day. The only variable was the title. Tracking this over time shows clear patterns for what your specific audience responds to. Many models use <a href="/dashboard" style={{ color: S.accent, textDecoration: 'none' }}>CamCash</a> to track session earnings by title type.
              </p>
            </div>
          </Section>

          {/* Section 7 — Hashtag Guide */}
          <Section id="hashtag-guide">
            <Tag color={S.pink}>Discoverability</Tag>
            <H2>Best Hashtags for Cam Models</H2>
            <Lead>Hashtags help platforms categorize your stream and surface it to the right viewers. A well-chosen hashtag set puts your room in front of audiences who are already looking for what you offer.</Lead>

            <div style={{ marginBottom: '32px' }}>
              <p style={{ fontSize: '14px', color: S.textMid, lineHeight: 1.8, marginBottom: '20px' }}>
                Most cam platforms use hashtags to power their discovery and recommendation systems. When you use #Lovense, you appear in feeds for viewers browsing interactive shows. When you use #Cosplay, you appear in genre searches. The algorithm groups content by tag clusters — which means your hashtag selection directly determines which audience segments can find you.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {Object.entries(HASHTAG_CATEGORIES).map(([category, tags]) => {
                const colors = { 'High Traffic': S.accent, 'Community': S.green, 'Niche': S.pink, 'Low Competition': S.gold }
                const descriptions = {
                  'High Traffic': 'Broad reach. High competition. These get you in front of large audiences but require more competition. Always include 2–3 of these.',
                  'Community': 'Platform-specific and behavior-specific tags. These reach viewers who are actively looking for interactive streams, goal shows, or tip-driven content.',
                  'Niche': 'Identity and content-specific tags. These reach smaller but more targeted audiences who are specifically looking for your type of content.',
                  'Low Competition': 'Emerging or specific tags with less competition. Lower volume but higher relevance — good for building a niche following.',
                }
                return (
                  <div key={category} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '10px', overflow: 'hidden' }}>
                    <div style={{ padding: '14px 18px', borderBottom: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: colors[category], background: `${colors[category]}18`, padding: '3px 8px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{category}</span>
                    </div>
                    <div style={{ padding: '14px 18px' }}>
                      <p style={{ fontSize: '13px', color: S.text, lineHeight: 1.6, marginBottom: '12px' }}>{descriptions[category]}</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {tags.map(tag => (
                          <span key={tag} style={{ fontSize: '12px', color: colors[category], background: `${colors[category]}12`, padding: '4px 10px', borderRadius: '5px', fontWeight: 600 }}>{tag}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Section>

          {/* Section 8 — Hashtag Formula */}
          <Section id="hashtag-formula">
            <Tag color={S.green}>Formula</Tag>
            <H2>The Viral Hashtag Formula</H2>
            <Lead>Don't pick hashtags randomly. Use this formula to build sets that balance reach, relevance, and discoverability.</Lead>

            <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '10px', padding: '20px 24px', marginBottom: '28px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                {[
                  { count: '2', type: 'High Traffic Tags', color: S.accent, example: '#Chaturbate #CamGirl' },
                  { count: '3', type: 'Community Tags', color: S.green, example: '#Lovense #GoalShow #TipMenu' },
                  { count: '3', type: 'Niche Tags', color: S.pink, example: '#Cosplay #GamerGirl #AltModel' },
                  { count: '2', type: 'Experimental Tags', color: S.gold, example: '#NewCamModel #StreamerLife' },
                ].map((item, i) => (
                  <div key={i} style={{ background: S.surface, borderRadius: '8px', padding: '14px 16px', border: `1px solid ${item.color}30` }}>
                    <div style={{ fontSize: '28px', fontWeight: 900, color: item.color, lineHeight: 1 }}>{item.count}</div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: S.textStrong, margin: '4px 0 6px' }}>{item.type}</div>
                    <div style={{ fontSize: '11px', color: S.text, fontStyle: 'italic' }}>{item.example}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: `1px solid ${S.border}`, fontSize: '13px', color: S.textMid }}>
                Total: <strong style={{ color: S.textStrong }}>10 hashtags</strong> — enough to maximize discoverability without diluting your signal.
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {HASHTAG_FORMULA_EXAMPLES.map((ex, i) => (
                <div key={i} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: '8px', padding: '14px 16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: S.accent, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{ex.label}</div>
                  <div style={{ fontSize: '13px', color: S.textMid, lineHeight: 1.7 }}>{ex.tags}</div>
                </div>
              ))}
            </div>
          </Section>

          {/* Section 9 — Mistakes */}
          <Section id="mistakes">
            <Tag color={S.red}>Avoid These</Tag>
            <H2>Common Room Title Mistakes</H2>
            <Lead>Most room title underperformance comes from a handful of avoidable mistakes. Here's what to watch for.</Lead>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
              {MISTAKES.map((m, i) => (
                <div key={i} style={{ background: S.card, border: `1px solid ${S.border}`, borderLeft: `3px solid ${S.red}`, borderRadius: '10px', padding: '16px 18px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: S.textStrong, marginBottom: '6px' }}>✗ {m.title}</div>
                  <div style={{ fontSize: '13px', color: S.text, lineHeight: 1.6 }}>{m.body}</div>
                </div>
              ))}
            </div>
          </Section>

          {/* Section 10 — Viewer Psychology */}
          <Section id="viewer-psychology">
            <Tag color={S.cyan}>Growth</Tag>
            <H2>How to Get More Viewers</H2>
            <Lead>More viewers start with a better title, but keeping them — and converting them into tippers — requires understanding what drives behavior in a cam room.</Lead>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
              {VIEWER_PSYCHOLOGY.map((item, i) => (
                <div key={i} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '10px', padding: '18px 20px' }}>
                  <div style={{ fontSize: '24px', marginBottom: '10px' }}>{item.icon}</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: S.textStrong, marginBottom: '8px' }}>{item.title}</div>
                  <div style={{ fontSize: '13px', color: S.text, lineHeight: 1.65 }}>{item.body}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '28px', background: S.surface, border: `1px solid ${S.border}`, borderRadius: '10px', padding: '20px 24px' }}>
              <p style={{ fontSize: '14px', color: S.textMid, lineHeight: 1.8, margin: 0 }}>
                Understanding <em>why</em> viewers tip is the foundation of every high-earning stream. Many creators track which titles and stream setups produce the highest earnings using tools like <a href="/dashboard" style={{ color: S.accent, textDecoration: 'none' }}>the CamCash dashboard</a>, which shows session-by-session earnings breakdowns and peak activity windows.
              </p>
            </div>
          </Section>

          {/* Section 11 — FAQ */}
          <Section id="faq">
            <Tag>FAQ</Tag>
            <H2>Frequently Asked Questions</H2>
            <Lead>Everything you need to know about room titles, hashtags, and growing your cam room audience.</Lead>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {faqSchema.mainEntity.map((item, i) => (
                <details key={i} style={{
                  background: S.card, border: `1px solid ${S.border}`, borderRadius: '8px',
                  overflow: 'hidden',
                }}>
                  <summary style={{
                    padding: '14px 18px', fontSize: '14px', fontWeight: 600, color: S.textStrong,
                    cursor: 'pointer', listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    {item.name}
                    <span style={{ color: S.accent, fontSize: '18px', flexShrink: 0, marginLeft: '12px' }}>+</span>
                  </summary>
                  <div style={{ padding: '0 18px 16px', fontSize: '14px', color: S.textMid, lineHeight: 1.75 }}>
                    {item.acceptedAnswer.text}
                  </div>
                </details>
              ))}
            </div>
          </Section>

          {/* Section 12 — Related Tools */}
          <Section id="tools" style={{ borderBottom: 'none' }}>
            <Tag color={S.green}>Creator Tools</Tag>
            <H2>More Free Creator Tools</H2>
            <Lead>A collection of free tools built for cam models and adult content creators.</Lead>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              {[
                { icon: '💰', title: 'Token Calculator', desc: 'Convert tokens to USD across platforms instantly.', href: '/guides/chaturbate-token-calculator' },
                { icon: '📊', title: 'Earnings Dashboard', desc: 'Track earnings, fan rankings, and session history with real data.', href: '/dashboard' },
                { icon: '🏷️', title: 'Cam Name Generator', desc: 'Generate cam names that are memorable and searchable.', href: '/guides' },
                { icon: '📈', title: 'Session Analytics', desc: 'Understand your peak hours, best days, and top fans.', href: '/demo' },
                { icon: '📄', title: 'CSV Import', desc: 'Upload your Chaturbate or BongaCams CSV to see your full history.', href: '/landing' },
                { icon: '🧩', title: 'Live Extension', desc: 'Capture tips in real time while you stream — no manual tracking.', href: '/extension' },
              ].map((tool, i) => (
                <a key={i} href={tool.href} style={{ textDecoration: 'none', display: 'block' }}>
                  <div style={{
                    background: S.card, border: `1px solid ${S.border}`, borderRadius: '10px', padding: '18px 20px',
                    transition: 'border-color 0.15s',
                    cursor: 'pointer',
                  }}>
                    <div style={{ fontSize: '24px', marginBottom: '10px' }}>{tool.icon}</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: S.textStrong, marginBottom: '6px' }}>{tool.title}</div>
                    <div style={{ fontSize: '13px', color: S.text, lineHeight: 1.5 }}>{tool.desc}</div>
                    <div style={{ fontSize: '12px', color: S.accent, marginTop: '10px' }}>Learn more →</div>
                  </div>
                </a>
              ))}
            </div>

            <div style={{ marginTop: '32px', textAlign: 'center', padding: '32px', background: S.surface, borderRadius: '12px', border: `1px solid ${S.border}` }}>
              <p style={{ fontSize: '14px', color: S.textMid, lineHeight: 1.7, margin: '0 0 4px' }}>
                Want to see how your titles and sessions are actually performing?
              </p>
              <p style={{ fontSize: '14px', color: S.textMid, lineHeight: 1.7, margin: 0 }}>
                <a href="/demo" style={{ color: S.accent, textDecoration: 'none', fontWeight: 600 }}>Try the CamCash demo →</a> — no signup required.
              </p>
            </div>
          </Section>

        </div>
      </div>
    </>
  )
}
