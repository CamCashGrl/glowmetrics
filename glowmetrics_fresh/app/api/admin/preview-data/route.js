import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyAdminToken } from "../../../../lib/adminAuth"

const STAGE_DATA = {
  "no-data": {
    tips: [], analytics: null,
    meta: { tipCount: 0, sessionCount: 0, totalEarnings: 0, platforms: [] },
  },
  "tiny-import": {
    tips: Array.from({ length: 18 }, (_, i) => ({
      id: `tip-${i}`, platform: "Chaturbate", tokens: 20 + i * 3,
      usd_amount: (20 + i * 3) * 0.05, tip_type: "manual_tip",
      username: `fan${i + 1}`, created_at: new Date(Date.now() - i * 86400000).toISOString(),
    })),
    analytics: {
      totalEarnings: 28.5, totalTips: 18, sessionCount: 1,
      platforms: [{ platform: "Chaturbate", earnings: 28.5, tipCount: 18 }],
      topFans: [{ username: "fan1", totalUsd: 9.5, tipCount: 4, tier: "Regular" }],
      hourlyRate: null, bestDay: null, bestHour: null,
    },
    meta: { tipCount: 18, sessionCount: 1, totalEarnings: 28.5, platforms: ["Chaturbate"] },
  },
  "first-valid-data": {
    tips: Array.from({ length: 60 }, (_, i) => ({
      id: `tip-${i}`, platform: i < 40 ? "Chaturbate" : "BongaCams",
      tokens: 30 + (i % 20) * 5, usd_amount: i < 40 ? (30 + (i % 20) * 5) * 0.05 : (30 + (i % 20) * 5) * 0.025,
      tip_type: i % 5 === 0 ? "private" : "manual_tip",
      username: `fan${(i % 8) + 1}`, created_at: new Date(Date.now() - i * 3600000 * 12).toISOString(),
    })),
    analytics: {
      totalEarnings: 142, totalTips: 60, sessionCount: 3,
      platforms: [
        { platform: "Chaturbate", earnings: 100, tipCount: 40 },
        { platform: "BongaCams",  earnings: 42,  tipCount: 20 },
      ],
      topFans: [
        { username: "fan2", totalUsd: 38, tipCount: 12, tier: "Emerging" },
        { username: "fan5", totalUsd: 22, tipCount: 8,  tier: "Emerging" },
        { username: "fan1", totalUsd: 15, tipCount: 5,  tier: "New" },
      ],
      hourlyRate: 28.4, bestDay: "Friday", bestHour: "9pm",
    },
    meta: { tipCount: 60, sessionCount: 3, totalEarnings: 142, platforms: ["Chaturbate","BongaCams"] },
  },
  "growing-insights": {
    tips: Array.from({ length: 180 }, (_, i) => ({
      id: `tip-${i}`, platform: ["Chaturbate","BongaCams","MyFreeCams"][i % 3],
      tokens: 50 + (i % 30) * 8, usd_amount: 2.5 + (i % 15) * 1.2,
      tip_type: i % 4 === 0 ? "private" : "manual_tip",
      username: `fan${(i % 15) + 1}`, created_at: new Date(Date.now() - i * 3600000 * 8).toISOString(),
    })),
    analytics: {
      totalEarnings: 620, totalTips: 180, sessionCount: 7,
      platforms: [
        { platform: "Chaturbate", earnings: 280, tipCount: 60 },
        { platform: "BongaCams",  earnings: 190, tipCount: 60 },
        { platform: "MyFreeCams", earnings: 150, tipCount: 60 },
      ],
      topFans: [
        { username: "fan3",  totalUsd: 145, tipCount: 28, tier: "Whale"   },
        { username: "fan7",  totalUsd: 88,  tipCount: 18, tier: "Whale"   },
        { username: "fan11", totalUsd: 52,  tipCount: 12, tier: "Whale"   },
        { username: "fan1",  totalUsd: 31,  tipCount: 9,  tier: "Emerging" },
      ],
      hourlyRate: 44.3, bestDay: "Saturday", bestHour: "10pm",
    },
    meta: { tipCount: 180, sessionCount: 7, totalEarnings: 620, platforms: ["Chaturbate","BongaCams","MyFreeCams"] },
  },
  "full-dashboard": {
    tips: Array.from({ length: 400 }, (_, i) => ({
      id: `tip-${i}`, platform: ["Chaturbate","BongaCams","MyFreeCams","Stripchat"][i % 4],
      tokens: 80 + (i % 50) * 10, usd_amount: 4 + (i % 20) * 2.5,
      tip_type: i % 3 === 0 ? "private" : i % 7 === 0 ? "group" : "manual_tip",
      username: `fan${(i % 25) + 1}`, created_at: new Date(Date.now() - i * 3600000 * 6).toISOString(),
    })),
    analytics: {
      totalEarnings: 3840, totalTips: 400, sessionCount: 18,
      platforms: [
        { platform: "Chaturbate", earnings: 1400, tipCount: 100 },
        { platform: "BongaCams",  earnings: 980,  tipCount: 100 },
        { platform: "MyFreeCams", earnings: 860,  tipCount: 100 },
        { platform: "Stripchat",  earnings: 600,  tipCount: 100 },
      ],
      topFans: [
        { username: "fan8",  totalUsd: 620, tipCount: 62, tier: "Whale"   },
        { username: "fan2",  totalUsd: 440, tipCount: 48, tier: "Whale"   },
        { username: "fan15", totalUsd: 220, tipCount: 28, tier: "Whale"   },
        { username: "fan19", totalUsd: 115, tipCount: 16, tier: "Whale"   },
        { username: "fan4",  totalUsd: 88,  tipCount: 14, tier: "Whale"   },
      ],
      hourlyRate: 62.8, bestDay: "Friday", bestHour: "9pm",
    },
    meta: { tipCount: 400, sessionCount: 18, totalEarnings: 3840, platforms: ["Chaturbate","BongaCams","MyFreeCams","Stripchat"] },
  },
  "live-active": {
    tips: Array.from({ length: 12 }, (_, i) => ({
      id: `live-${i}`, platform: "Chaturbate", tokens: 10 + i * 5,
      usd_amount: (10 + i * 5) * 0.05, tip_type: "live_tip",
      username: `viewer${i + 1}`, created_at: new Date(Date.now() - i * 120000).toISOString(),
    })),
    analytics: {
      totalEarnings: 28.5, totalTips: 12, sessionCount: 1,
      platforms: [{ platform: "Chaturbate", earnings: 28.5, tipCount: 12 }],
      topFans: [{ username: "viewer3", totalUsd: 7.5, tipCount: 3, tier: "Regular" }],
      hourlyRate: 57, bestDay: null, bestHour: null,
      liveActive: true, liveEarningsToday: 28.5,
    },
    meta: { tipCount: 12, sessionCount: 1, totalEarnings: 28.5, platforms: ["Chaturbate"], liveActive: true },
  },
}

export async function GET(req) {
  const cookieStore = cookies()
  const adminCookie = cookieStore.get("gm_admin")
  if (!verifyAdminToken(adminCookie?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const stage = searchParams.get("stage") || "no-data"
  const stageData = STAGE_DATA[stage] || STAGE_DATA["no-data"]

  return NextResponse.json({ stage, ...stageData })
}
