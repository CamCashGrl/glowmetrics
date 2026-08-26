// SEO + on-site content layer for the Pretty Profitz shop.
//
// lib/shop-products.js holds the raw listing data mirrored from Etsy (titles,
// prices, images, Etsy copy). This file holds everything written *for the
// site*: unique meta descriptions, scannable highlights, FAQ content that
// feeds FAQPage schema, and the internal links that connect each product to
// the matching free tracker/guide (and back again).
//
// Keeping the two files separate means re-syncing Etsy copy never clobbers
// hand-written SEO content.

export const SHOP_SEO = {
  "daddys-girl-roleplay-script-pack": {
    subtitle:
      "A 32-page DDLG-style cam script with openers, praise lines, bratty prompts and five ready-made session recipes.",
    metaDescription:
      "32-page Daddy's Girl cam roleplay script pack for adult creators: full session script, praise and bratty prompts, session recipes and planning worksheets.",
    highlights: [
      "Full 3-page start-to-finish private session script",
      "Flirty, sweet, bratty and praise-focused dialogue banks",
      "Viewer response prompts so you never freeze mid-scene",
      "5 ready-made session recipes you can run as written",
      "Customization worksheets and viewer profile pages",
    ],
    faqs: [
      {
        q: "Is this a fillable PDF or a printable one?",
        a: "It is a 32-page digital PDF with large, easy-to-read text. The worksheet pages are designed to be printed and filled in by hand, or annotated in any PDF reader.",
      },
      {
        q: "Will my sessions sound scripted if I read from it?",
        a: "The pack is built as dialogue banks rather than a single monologue. Most creators pull two or three lines per beat and improvise between them, which is why the opening, praise, bratty and closing lines are separated out.",
      },
      {
        q: "Can I use it on any cam platform?",
        a: "Yes. Nothing in the pack is platform-specific, so it works for Chaturbate, Stripchat, MyFreeCams, BongaCams private shows, or custom video and audio orders.",
      },
    ],
    tools: [
      { href: "/blog/cam-session-scripts-for-models", label: "Cam session scripts for models", blurb: "Free breakdown of how to structure a paid session start to finish." },
      { href: "/guides/cam-model-session-breakdown", label: "Session breakdown tracker", blurb: "See which of your sessions actually earn, not just which ones felt good." },
      { href: "/blog/girlfriend-experience-gfe-cam-modeling-strategy", label: "GFE strategy guide", blurb: "Where soft, praise-led personas fit in a wider content mix." },
    ],
    related: ["good-morning-gfe-joi-script", "playful-sph-cam-script-pack", "320-tip-menu-ideas"],
  },

  "playful-sph-cam-script-pack": {
    subtitle:
      "38 pages of light, giggly SPH dialogue — teasing lines, escalation beats and consent notes, without the harsh domination tone.",
    metaDescription:
      "38-page playful SPH cam script pack: full session flow, giggly teasing lines, soft humiliation dialogue, escalation beats and creator safety notes.",
    highlights: [
      "Complete SPH session flow from first reaction to closing",
      "Playful, amused tone rather than harsh domination",
      "Nickname ideas, sarcastic reassurance and compliment-tease mixes",
      "Mid-session escalation and multiple tone variations",
      "Consent, boundary and creator safety notes included",
    ],
    faqs: [
      {
        q: "How is this different from a general humiliation script?",
        a: "The tone is deliberately lighter. It leans on giggly teasing, playful nicknames and compliments mixed with humiliation, so it suits creators whose persona is flirty rather than cruel.",
      },
      {
        q: "Does it cover consent and boundaries?",
        a: "Yes. The pack includes consent and creator safety notes plus a customization worksheet for marking which lines you will and will not use.",
      },
      {
        q: "Can I print it?",
        a: "Yes — 38 pages of large-type PDF in a dark charcoal and red workbook layout, usable on screen or printed at home.",
      },
    ],
    tools: [
      { href: "/blog/cam-session-scripts-for-models", label: "Cam session scripts for models", blurb: "Free session structure guide to build your own flow around." },
      { href: "/blog/cam-model-boundaries-toxic-chat", label: "Boundaries and toxic chat", blurb: "How to hold a kink persona without letting chat run over your limits." },
      { href: "/guides/cam-model-top-tippers", label: "Top tippers tracker", blurb: "Spot which regulars actually respond to teasing content." },
    ],
    related: ["daddys-girl-roleplay-script-pack", "how-to-train-paypig", "mistress-contract-128-rules"],
  },

  "vip-client-tracker-1299": {
    subtitle:
      "The expanded 24-page VIP CRM: everything in the 17-page workbook plus re-engagement trackers, monthly graphs and a tier builder.",
    metaDescription:
      "24-page fillable VIP client tracker for cam models: master list, client profiles, tip history, session logs, re-engagement pages and monthly VIP graphs.",
    highlights: [
      "24 fillable pages — type directly, no printing required",
      "VIP master list plus detailed per-client profiles",
      "3 tip and spending history pages, 2 session logs",
      "3 re-engagement tracker pages and a follow-up planner",
      "Monthly VIP overview with graphs, scorecard and tier builder",
    ],
    faqs: [
      {
        q: "How is this different from the $9.99 version?",
        a: "This is the expanded edition: 24 pages instead of 17, with extra tip history, session log, follow-up and re-engagement pages, plus a monthly overview with graphs and additional notes and safety templates.",
      },
      {
        q: "Is it safe to store client details in a PDF?",
        a: "Use platform usernames and creator-safe identifiers only — never legal names, addresses or payment details. The workbook's safety pages cover this, and the same rule applies to any CRM you use.",
      },
      {
        q: "Do you take bulk or custom orders?",
        a: "Yes. Bulk and personalised requests are handled by email or Etsy message.",
      },
    ],
    tools: [
      { href: "/free-vip-tracker", label: "Free VIP tracker", blurb: "The free web version — try the workflow before buying the workbook." },
      { href: "/guides/cam-model-top-tippers", label: "Top tippers guide", blurb: "How to rank regulars by real spend instead of gut feeling." },
      { href: "/blog/cam-model-fan-crm", label: "Cam model fan CRM", blurb: "Why a client list beats memory once you pass a handful of regulars." },
      { href: "/blog/how-to-re-engage-whales-and-high-tipping-fans", label: "Re-engaging high tippers", blurb: "What to send a lapsed whale, and when." },
    ],
    related: ["vip-client-tracker-999", "chaturbate-earnings-tracker-bundle", "cam-model-branding-kit"],
  },

  "vip-client-tracker-999": {
    subtitle:
      "The 17-page fillable VIP CRM — usernames, spend, sessions, boundaries and follow-ups in one reusable workbook.",
    metaDescription:
      "17-page fillable cam model VIP client tracker: master list, client profiles, tip and spending history, session log, follow-up planner and VIP tier builder.",
    highlights: [
      "17 fillable pages, printable and reusable",
      "Track usernames, platforms, tips, sessions and preferences",
      "Boundaries page so limits live with the client record",
      "Follow-up planner and re-engagement tracker",
      "VIP relationship scorecard and custom tier builder",
    ],
    faqs: [
      {
        q: "Should I start with this or the 24-page version?",
        a: "Start here if you are tracking a handful of regulars. The 24-page edition adds extra history, follow-up and re-engagement pages plus monthly graphs, which matter more once your VIP list grows.",
      },
      {
        q: "Can I fill it in on my phone?",
        a: "The form fields work in most mobile PDF readers, though it is easier on a tablet or laptop. It also prints cleanly if you prefer paper.",
      },
      {
        q: "Is there a free version?",
        a: "There is a free web-based VIP tracker on this site you can use to test the workflow before buying the workbook.",
      },
    ],
    tools: [
      { href: "/free-vip-tracker", label: "Free VIP tracker", blurb: "Free web version of this workflow — no download needed." },
      { href: "/blog/cam-model-fan-crm", label: "Cam model fan CRM", blurb: "The case for tracking regulars properly." },
      { href: "/blog/how-to-build-loyal-fans", label: "Building loyal fans", blurb: "Turning one-off tippers into repeat regulars." },
      { href: "/guides/cam-model-top-tippers", label: "Top tippers guide", blurb: "Rank your room by actual contribution." },
    ],
    related: ["vip-client-tracker-1299", "chaturbate-earnings-tracker-bundle", "320-tip-menu-ideas"],
  },

  "cam-model-branding-kit": {
    subtitle:
      "A 53+ page branding workbook for defining your persona, niche, boundaries, visual identity and content plan in one place.",
    metaDescription:
      "53+ page cam model branding kit workbook: persona, niche and audience worksheets, boundaries pages, visual identity planning, content strategy and brand goals.",
    highlights: [
      "Brand persona and niche worksheets",
      "Audience planning and offer ideas",
      "Boundaries and comfort-zone pages",
      "Visual identity, colour and social strategy planning",
      "Privacy and anonymity guidance for adult creators",
    ],
    faqs: [
      {
        q: "Is this useful if I already stream?",
        a: "Yes — it is most often used for rebrands. The persona, niche and visual identity sections are just as applicable to tightening an existing brand as to starting one.",
      },
      {
        q: "Does it cover staying anonymous?",
        a: "There is a dedicated privacy and anonymity section covering what to keep out of your branding and public content.",
      },
      {
        q: "Do I need design software?",
        a: "No. It is a printable planning workbook — the visual identity pages help you decide what to brief or build, not design it in-app.",
      },
    ],
    tools: [
      { href: "/tools/profile-studio", label: "Profile Studio", blurb: "Free tool for writing bios, tip menus and profile copy." },
      { href: "/tools/cam-model-name-generator", label: "Cam name generator", blurb: "Free name ideas if your persona is still unnamed." },
      { href: "/blog/how-to-find-your-cam-model-niche", label: "Finding your niche", blurb: "Free guide to picking a niche that actually converts." },
      { href: "/blog/how-cam-models-stay-anonymous", label: "Staying anonymous", blurb: "Privacy practices to lock in before you publish a brand." },
    ],
    related: ["500-cam-room-titles", "320-tip-menu-ideas", "spin-the-wheel-template-pack"],
  },

  "good-morning-gfe-joi-script": {
    subtitle:
      "A voice-ready 12–20 minute GFE JOI script for customs, PPV and audio orders — soft opening through guided finish and aftercare.",
    metaDescription:
      "Good morning GFE JOI script for adult creators: a 12-20 minute voice-ready custom video and audio script with build, edge, permission and aftercare sections.",
    highlights: [
      "Complete 12–20 minute voice-ready script",
      "Soft girlfriend wake-up opening into explicit guidance",
      "Two build-and-edge sections plus permission-to-finish sequence",
      "Bratty, possessive, explicit and praise line variations",
      "Personalisation worksheet and recording/pacing guidance",
    ],
    faqs: [
      {
        q: "What formats is this designed for?",
        a: "Custom videos, personalised voice notes, PPV messages, clip-store content, subscription posts and cam custom orders — anywhere you record rather than improvise live.",
      },
      {
        q: "Can I personalise it per buyer?",
        a: "Yes. The customer-personalisation worksheet is there to swap names, details and tone per order without rewriting the script.",
      },
      {
        q: "Does it include recording advice?",
        a: "It includes voice, pacing and recording guidance so the delivery matches the script's build.",
      },
    ],
    tools: [
      { href: "/blog/girlfriend-experience-gfe-cam-modeling-strategy", label: "GFE strategy guide", blurb: "Free guide to positioning GFE content and pricing customs." },
      { href: "/blog/cam-session-scripts-for-models", label: "Session scripts guide", blurb: "Structuring a paid session or recording." },
      { href: "/blog/cam-model-income-diversification", label: "Income diversification", blurb: "Where customs and PPV fit alongside live streaming." },
    ],
    related: ["daddys-girl-roleplay-script-pack", "101-sexting-tips", "playful-sph-cam-script-pack"],
  },

  "roll-the-dice-game-pack": {
    subtitle:
      "Both editions of the roll-the-dice pack — a 10-page fillable pink workbook plus the original prompt set, for rooms without a dice bot.",
    metaDescription:
      "Cam model roll-the-dice game pack: fillable pink workbook plus the original dice prompt set, with everyday, bratty, non-nude, toy, goal and premium dice games.",
    highlights: [
      "Two full versions — fillable pink workbook and original pack",
      "Everyday, bratty, non-nude, toy, goal boost and premium dice",
      "Blank custom dice template for your own prompts",
      "Game setup worksheet and how-to-use instructions",
      "Works on any site, no dice bot required",
    ],
    faqs: [
      {
        q: "Do I need a bot or app to run this?",
        a: "No. You set a roll price, the viewer tips, you roll a standard six-sided die on camera and perform the matching result. That is the whole loop, which is why it works on sites with no dice app.",
      },
      {
        q: "Is there a non-nude option?",
        a: "Yes — one of the included dice sets is entirely non-nude, which suits slower rooms and non-nude platforms.",
      },
      {
        q: "Can I set my own prompts?",
        a: "The blank custom dice template is included for exactly that.",
      },
    ],
    tools: [
      { href: "/blog/cam-room-dice-games", label: "Cam room dice games", blurb: "Free guide to running dice games and pricing rolls." },
      { href: "/blog/what-to-do-when-cam-room-is-slow", label: "Slow room rescue", blurb: "Games and resets for a room that has gone quiet." },
      { href: "/guides/cam-model-session-breakdown", label: "Session breakdown", blurb: "Check whether game nights actually out-earn normal streams." },
    ],
    related: ["spin-the-wheel-template-pack", "320-tip-menu-ideas", "500-cam-room-titles"],
  },

  "spin-the-wheel-template-pack": {
    subtitle:
      "8 editable Canva spin-the-wheel designs plus a PDF reference copy — rebrand the labels and export in minutes.",
    metaDescription:
      "8 editable Canva spin-the-wheel templates for cam rooms: everyday, bratty, soft dom, non-nude, toy, premium, goal and blank custom wheel designs, plus PDF guide.",
    highlights: [
      "8 wheel designs: everyday, bratty, soft dom, non-nude, toy, premium, goal, blank",
      "Fully editable in Canva — a free account is enough",
      "Export finished wheels as PNG, JPG or PDF",
      "PDF wheel pack and setup guide included",
      "Blank wheel for building your own game",
    ],
    faqs: [
      {
        q: "Do I need Canva Pro?",
        a: "No, a free Canva account can open and edit the templates.",
      },
      {
        q: "Can I change more than the words?",
        a: "Yes — labels, wording, colours and text styling are all editable, so the wheels can match your brand rather than the stock design.",
      },
      {
        q: "How do I get the templates?",
        a: "The download includes a Canva-access PDF with the template link. Open it, choose 'Use this template', and the wheels copy into your own Canva account.",
      },
    ],
    tools: [
      { href: "/blog/spin-the-wheel-cam-game", label: "Spin the wheel cam game", blurb: "Free guide to running wheel games and setting spin prices." },
      { href: "/tools/profile-studio", label: "Profile Studio", blurb: "Match your wheel wording to your tip menu and bio." },
      { href: "/blog/how-to-get-more-viewers-as-a-cam-model", label: "Getting more viewers", blurb: "Games only pay off in a room people can find." },
    ],
    related: ["roll-the-dice-game-pack", "320-tip-menu-ideas", "cam-model-branding-kit"],
  },

  "320-tip-menu-ideas": {
    subtitle:
      "20 editable Canva tip menus plus a 30-page guide with 320 realistic menu ideas, a pricing worksheet and a performance tracker.",
    metaDescription:
      "Cam model tip menu templates: 20 editable Canva menus plus a 30-page PDF with 320 tip menu ideas, token pricing worksheet, performance tracker and menu planner.",
    highlights: [
      "20 editable Canva tip menu templates",
      "320 realistic tip menu ideas across everyday, toy, game, show and premium",
      "Blank token-price spaces so pricing stays yours",
      "Pricing worksheet and menu performance tracker",
      "Custom menu planner for niche rooms",
    ],
    faqs: [
      {
        q: "Are the token prices filled in?",
        a: "No, deliberately. Token values differ by platform and by room, so the menus ship with blank price spaces and a pricing worksheet to work yours out.",
      },
      {
        q: "Is the PDF fillable?",
        a: "The Canva templates are editable; the 30-page PDF is a reference and worksheet file rather than a fillable form.",
      },
      {
        q: "Does it integrate with tipping software?",
        a: "No. These are menu designs and pricing tools — there is no bot or live platform integration included.",
      },
    ],
    tools: [
      { href: "/tools/profile-studio", label: "Profile Studio tip menu generator", blurb: "Free tool for drafting menu wording before you design it." },
      { href: "/guides/chaturbate-token-calculator", label: "Token calculator", blurb: "Convert token prices to real dollars before you set a menu." },
      { href: "/blog/how-to-increase-chaturbate-tips", label: "Increasing tips", blurb: "Free guide to menu placement and goal structure." },
      { href: "/guides/cam-model-token-calculator", label: "Cam model token calculator", blurb: "Cross-platform token to USD maths." },
    ],
    related: ["500-cam-room-titles", "roll-the-dice-game-pack", "chaturbate-earnings-tracker-bundle"],
  },

  "mistress-contract-128-rules": {
    subtitle:
      "An 18-page femdom training bundle: customisable contract, 128 original rules, limits worksheet and a 30-day plan with trackers.",
    metaDescription:
      "Mistress contract and 128 slave rules bundle: customisable contract pages, limits and preferences worksheet, 30-day training plan, trackers and weekly review.",
    highlights: [
      "Customisable Mistress contract with custom-terms and signature pages",
      "128 original rules for a well-trained submissive",
      "Limits and preferences worksheet",
      "30-day training plan with task, offering and obedience trackers",
      "Weekly review worksheet and certificate of completion",
    ],
    faqs: [
      {
        q: "Is this a legally binding contract?",
        a: "No. It creates no legal ownership and is not legal advice. It is a structure for consenting adults, and it cannot override consent, hard limits, safety or either person's right to stop at any time.",
      },
      {
        q: "What is explicitly out of bounds?",
        a: "The workbook prohibits coercion, blackmail, doxxing, identity theft, unauthorised account access, threats, illegal activity, and involving anyone who has not consented.",
      },
      {
        q: "Can I use it for online dynamics?",
        a: "Yes — the tracking and weekly review pages work for remote dynamics as well as in-person ones, provided limits and safewords are negotiated first.",
      },
    ],
    tools: [
      { href: "/blog/findom-kink-niche", label: "The findom niche", blurb: "Free breakdown of how femdom and findom rooms actually earn." },
      { href: "/blog/cam-model-boundaries-toxic-chat", label: "Boundaries and toxic chat", blurb: "Holding limits inside a dominant persona." },
      { href: "/blog/findom-message-scripts-for-creators", label: "Findom message scripts", blurb: "Free message structures for dominant creators." },
    ],
    related: ["101-ways-train-sissy", "how-to-train-paypig", "bondage-for-beginners"],
  },

  "bondage-for-beginners": {
    subtitle:
      "A 21-page beginner bondage guide and workbook — consent, safety, four illustrated ties, scene planning and aftercare.",
    metaDescription:
      "Bondage for beginners guide and BDSM safety workbook: consent and negotiation, body-zone warnings, four illustrated beginner ties, scene planning and aftercare.",
    highlights: [
      "Beginner safety guidance and consent negotiation tips",
      "Body-zone guidance and warning signs to stop",
      "Four illustrated beginner knots and ties",
      "Pre-scene checklist, boundaries and scene-planning worksheets",
      "Check-in questions, nonverbal signals and aftercare guidance",
    ],
    faqs: [
      {
        q: "Does it cover suspension or breath play?",
        a: "No, and that is deliberate. Suspension, breath restriction, neck restraint and hogties are all excluded — this is a slow, beginner-level resource focused on easy release.",
      },
      {
        q: "Which ties are taught?",
        a: "Four beginner ties: the overhand stopper knot, square knot, quick-release bow and loose single-column cuff.",
      },
      {
        q: "Is this a substitute for in-person training?",
        a: "No. It is an educational beginner resource, not medical or legal advice, and it does not replace qualified hands-on instruction.",
      },
    ],
    tools: [
      { href: "/blog/how-to-find-your-cam-model-niche", label: "Finding your niche", blurb: "Where kink content fits in a creator's wider offer." },
      { href: "/blog/cam-model-boundaries-toxic-chat", label: "Boundaries and toxic chat", blurb: "Negotiating limits with viewers, not just partners." },
      { href: "/blog/how-to-stay-safe-as-a-cam-model", label: "Staying safe", blurb: "Free safety guide for adult creators." },
    ],
    related: ["mistress-contract-128-rules", "101-sexting-tips", "101-ways-train-sissy"],
  },

  "101-sexting-tips": {
    subtitle:
      "A 61-page long-distance intimacy guide: 101 structured tips across 11 categories, plus boundary and date-night worksheets.",
    metaDescription:
      "101 sexting tips for long distance relationships: a 61-page guide with flirty openers, voice note ideas, roleplay prompts, date night plans and boundary worksheets.",
    highlights: [
      "101 structured tips across 11 categories",
      "Flirty openers, romantic prompts and dirty talk confidence",
      "Voice note, audio and visual teasing guidance",
      "Long-distance date night ideas and planner",
      "Consent, privacy and boundaries worksheet",
    ],
    faqs: [
      {
        q: "Is this written for couples or creators?",
        a: "It is written for adult couples in long-distance relationships. Creators do use it for message ideas, but the framing, worksheets and date-night sections are couple-focused.",
      },
      {
        q: "Does it cover privacy?",
        a: "Yes — there is a full category on consent, privacy and boundaries, including what to think about before sending photos or audio.",
      },
      {
        q: "What if the spark has already gone flat?",
        a: "There is a dedicated 'reconnecting after a dry spell' category plus a connection check-in worksheet for exactly that.",
      },
    ],
    tools: [
      { href: "/blog/findom-message-scripts-for-creators", label: "Message scripts for creators", blurb: "Free message structures if you are writing for fans rather than a partner." },
      { href: "/blog/how-to-build-loyal-fans", label: "Building loyal fans", blurb: "How consistent messaging builds repeat regulars." },
    ],
    related: ["good-morning-gfe-joi-script", "daddys-girl-roleplay-script-pack", "bondage-for-beginners"],
  },

  "101-ways-train-sissy": {
    subtitle:
      "53 pages of sissy training assignments across 11 categories, each with a reason, a task, a release condition and a stricter variant.",
    metaDescription:
      "101 ways to punish your sissy: a 53-page femdom and findom training guide with 11 assignment categories, printable trackers and stricter optional variations.",
    highlights: [
      "101 assignments written in a direct Mistress voice",
      "11 categories from financial correction to worship and service",
      "Each task has 'why you earned it' and a release condition",
      "Optional 'make it meaner' variation on every punishment",
      "Printable trackers included",
    ],
    faqs: [
      {
        q: "How are the financial tasks handled?",
        a: "Financial punishments are explicitly limited to pre-agreed disposable income and must never interfere with essential living expenses. Budgets are meant to be negotiated before you start.",
      },
      {
        q: "What are the 11 categories?",
        a: "Financial correction, feminine grooming and presentation, domestic service, writing and repetition, obedience and protocol, accountability, controlled humiliation, privilege removal, psychological conditioning, brat correction, and worship and service.",
      },
      {
        q: "Is it suitable for online-only dynamics?",
        a: "Yes. Most assignments are remote-friendly, with completion requirements you can verify without meeting in person.",
      },
    ],
    tools: [
      { href: "/blog/findom-kink-niche", label: "The findom niche", blurb: "Free guide to how findom and sissy training rooms earn." },
      { href: "/blog/findom-message-scripts-for-creators", label: "Findom message scripts", blurb: "Message structures that hold a dominant voice." },
      { href: "/guides/cam-model-top-tippers", label: "Top tippers tracker", blurb: "Track which submissives actually follow through." },
    ],
    related: ["how-to-train-paypig", "mistress-contract-128-rules", "playful-sph-cam-script-pack"],
  },

  "how-to-train-paypig": {
    subtitle:
      "A plug-and-play findom script: full tribute conversation flow, expected responses, placeholders and a condensed chat version.",
    metaDescription:
      "Plug and play paypig training script for findom creators: full tribute conversation flow, three tribute stages, expected responses and a copy-paste chat version.",
    highlights: [
      "Complete opening, training, tribute and closing sequences",
      "Three customisable tribute stages",
      "Expected paypig responses so you are never caught out",
      "Placeholders for name, tribute amounts and payment method",
      "Condensed copy-and-paste version for live chat",
    ],
    faqs: [
      {
        q: "Is the file editable?",
        a: "It is delivered as a locked, non-editable PDF. You copy the script text into your own messages and replace the bracketed placeholders — there is no Canva template.",
      },
      {
        q: "Can I use it live in chat?",
        a: "Yes, that is what the condensed copy-and-paste chat version is for. The full script is better suited to DMs and longer sessions.",
      },
      {
        q: "Who is it written for?",
        a: "Findom creators, bratty dommes and financial dominants who want a consistent cold, entitled voice without writing every reply from scratch.",
      },
    ],
    tools: [
      { href: "/blog/findom-message-scripts-for-creators", label: "Findom message scripts", blurb: "Free message structures to pair with the script." },
      { href: "/blog/findom-kink-niche", label: "The findom niche", blurb: "How findom income actually behaves month to month." },
      { href: "/blog/how-to-re-engage-whales-and-high-tipping-fans", label: "Re-engaging whales", blurb: "Bringing a lapsed tribute back without begging." },
      { href: "/free-vip-tracker", label: "Free VIP tracker", blurb: "Track tribute history per submissive." },
    ],
    related: ["101-ways-train-sissy", "mistress-contract-128-rules", "vip-client-tracker-999"],
  },

  "500-cam-room-titles": {
    subtitle:
      "500 copy-paste room titles sorted by vibe and goal, plus a text file and fill-in-the-blank formulas for writing your own.",
    metaDescription:
      "500 high converting cam room titles: copy and paste title ideas by category, a quick-use text file, fill-in-the-blank title formulas and room title tips.",
    highlights: [
      "500 ready-to-use titles organised by vibe, goal and stream style",
      "Copy-and-paste text file for fast setup before going live",
      "Fill-in-the-blank formulas for building fresh titles",
      "Categories including slow room rescue and tip goal titles",
      "Works on Chaturbate, Stripchat, MyFreeCams and BongaCams",
    ],
    faqs: [
      {
        q: "Won't other models be using the same titles?",
        a: "That is why the fill-in-the-blank formulas are included — most creators use the 500 as a starting bank and the formulas to generate titles nobody else is running.",
      },
      {
        q: "What format is the text file?",
        a: "A plain text file you can keep open while setting up your room, so titles are one copy away rather than buried in a PDF.",
      },
      {
        q: "Is there a free alternative?",
        a: "There is a free room title generator on this site. The pack is for creators who want a large sorted bank rather than one title at a time.",
      },
    ],
    tools: [
      { href: "/guides/cam-model-room-title-generator", label: "Room title generator", blurb: "Free generator — try it before buying the bank of 500." },
      { href: "/guides/chaturbate-room-title-generator", label: "Chaturbate title generator", blurb: "Chaturbate-specific title ideas, free." },
      { href: "/blog/viral-cam-room-titles", label: "Viral cam room titles", blurb: "Free breakdown of what makes a title get clicked." },
      { href: "/blog/how-to-get-views-on-chaturbate", label: "Getting views on Chaturbate", blurb: "Where titles sit in the wider discovery picture." },
    ],
    related: ["320-tip-menu-ideas", "cam-model-branding-kit", "chaturbate-earnings-tracker-bundle"],
  },

  "chaturbate-earnings-tracker-bundle": {
    subtitle:
      "A 44-page Chaturbate performance workbook: stream logs, tip menu pricing, a 14-day best-time challenge and an earnings calculator.",
    metaDescription:
      "Chaturbate earnings tracker bundle: 44-page workbook with daily stream logs, tip menu pricing, 50 goal ideas, a 14-day best-time challenge and earnings calculator.",
    highlights: [
      "Daily stream log and detailed session review pages",
      "Track tokens, estimated USD, unique tippers and hourly pace",
      "Tip menu pricing worksheet plus 50 room goal ideas",
      "14-day best-time streaming challenge to find your strongest hours",
      "30 boundary-safe follow-up starters and a monthly dashboard",
    ],
    faqs: [
      {
        q: "How does this compare to the free trackers on this site?",
        a: "The free trackers and guides here calculate for you from your own data. The workbook is the paper version: it is for creators who want to log by hand, run the 14-day best-time challenge, and plan offline.",
      },
      {
        q: "Is it only useful for Chaturbate?",
        a: "The token maths and goal examples are Chaturbate-shaped, but the stream logs, best-time challenge and follow-up starters transfer to any token-based platform.",
      },
      {
        q: "What is the 14-day best-time challenge?",
        a: "A structured two-week test that has you stream across different windows and compare tokens and hourly pace, so your schedule is chosen on data rather than habit.",
      },
    ],
    tools: [
      { href: "/guides/chaturbate-earnings-tracker", label: "Chaturbate earnings tracker", blurb: "Free tracker guide — the automated counterpart to this workbook." },
      { href: "/guides/chaturbate-best-hours", label: "Chaturbate best hours", blurb: "Free data on which hours actually pay." },
      { href: "/guides/best-time-to-stream-chaturbate", label: "Best time to stream", blurb: "Free scheduling guide to run alongside the 14-day challenge." },
      { href: "/guides/chaturbate-token-tracker", label: "Chaturbate token tracker", blurb: "Track tokens without logging every stream by hand." },
      { href: "/guides/cam-model-income-tracker", label: "Cam model income tracker", blurb: "Cross-platform income tracking." },
      { href: "/guides/cam-model-analytics", label: "Cam model analytics", blurb: "What the numbers in the workbook look like once they are automated." },
    ],
    related: ["vip-client-tracker-1299", "320-tip-menu-ideas", "500-cam-room-titles"],
  },
};

// Shop-wide FAQ — feeds the FAQPage schema and the on-page content block at
// /shop, which previously had no indexable copy beyond a card grid.
export const SHOP_FAQS = [
  {
    q: "Who makes these products?",
    a: "Everything in the shop is written by a working cam creator and sold through the Pretty Profitz Etsy store. Buying goes through Etsy, so payment, delivery and buyer protection are handled there.",
  },
  {
    q: "How is delivery handled?",
    a: "Every item is an instant digital download. Nothing is shipped physically — you get the files from Etsy immediately after checkout.",
  },
  {
    q: "What formats are the files?",
    a: "Most products are PDFs, some with fillable form fields. The tip menu and spin-the-wheel packs also include editable Canva templates, which a free Canva account can open.",
  },
  {
    q: "Do I need to buy anything to track my earnings?",
    a: "No. The trackers, calculators and title generators on this site are free to use. The shop workbooks are the printable, offline counterparts for creators who prefer to plan on paper.",
  },
  {
    q: "Can I resell or share what I buy?",
    a: "No. Every product is licensed for one creator's personal or business use. Resale, sharing, copying and redistribution are prohibited.",
  },
];

export function getSeo(slug) {
  return SHOP_SEO[slug] || null;
}

// Reverse index of SHOP_SEO[].tools: given an on-site path, which products
// point at it? This is what makes the linking bidirectional without a second
// hand-maintained list — add a tool link to a product and the matching
// tracker/guide picks up the product automatically.
const REVERSE_TOOL_INDEX = (() => {
  const index = {};
  for (const [slug, seo] of Object.entries(SHOP_SEO)) {
    for (const tool of seo.tools || []) {
      (index[tool.href] ||= []).push(slug);
    }
  }
  return index;
})();

export function getProductsForPath(path) {
  return REVERSE_TOOL_INDEX[path] || [];
}
