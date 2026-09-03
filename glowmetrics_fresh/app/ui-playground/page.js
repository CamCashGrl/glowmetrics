"use client"
import React, { useState } from "react"
import styles from "./playground.module.css"

const DashboardPlayground = () => {
  const [selectedPlatform, setSelectedPlatform] = useState("all")
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  // Realistic CamCash data
  const totalEarnings = 12485
  const monthlyTips = 4320
  const streamingHours = 48.5
  const uniqueFans = 156

  const platforms = [
    {
      name: "Chaturbate",
      earnings: 5240,
      percentage: 42,
      tokens: 185,
      rate: 0.05,
      hours: 12.5,
    },
    {
      name: "MyFreeCams",
      earnings: 4385,
      percentage: 35,
      tokens: 8740,
      rate: 0.5,
      hours: 14.2,
    },
    {
      name: "BongaCams",
      earnings: 2860,
      percentage: 23,
      tokens: 1430,
      rate: 2.0,
      hours: 10.8,
    },
  ]

  const topFans = [
    { name: "Whale_King", tips: 540, sessions: 23, favorite: "dildo_show" },
    {
      name: "Purple_Passion",
      tips: 385,
      sessions: 18,
      favorite: "squirt_show",
    },
    { name: "SkyDreamer", tips: 320, sessions: 14, favorite: "chat_only" },
    { name: "NeonLover", tips: 285, sessions: 11, favorite: "dildo_show" },
    { name: "TokenWhiz", tips: 240, sessions: 9, favorite: "oil_massage" },
  ]

  const recentSessions = [
    {
      id: 1,
      platform: "Chaturbate",
      date: "Today, 10:45 PM",
      duration: "2.5 hrs",
      earnings: 340,
      viewers: 156,
    },
    {
      id: 2,
      platform: "MyFreeCams",
      date: "Today, 8:15 PM",
      duration: "1.8 hrs",
      earnings: 285,
      viewers: 98,
    },
    {
      id: 3,
      platform: "BongaCams",
      date: "Yesterday, 11:30 PM",
      duration: "3.2 hrs",
      earnings: 420,
      viewers: 203,
    },
  ]

  const analyticsMetrics = [
    { label: "Total Earnings", value: "$12,485", change: "+18% vs last month" },
    {
      label: "Avg $/Hour",
      value: "$287",
      change: "+12% from last month",
    },
    { label: "Peak Viewers", value: "203", change: "on BongaCams" },
    { label: "Days Streaming", value: "18/30", change: "4 off-days remaining" },
  ]

  return (
    <div className={styles.dashboardContainer}>
      {/* COSMIC BACKGROUND */}
      <div className={styles.cosmicBackground}></div>

      {/* MAIN DASHBOARD LAYOUT */}
      <div className={styles.dashboardShell}>
        {/* SIDEBAR NAVIGATION */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarContent}>
            <div className={styles.logoArea}>
              <div className={styles.logoIcon}>💰</div>
              <div className={styles.logoText}>
                <span className={styles.logoCam}>Cam</span>
                <span className={styles.logoCash}>Cash</span>
              </div>
            </div>

            <nav className={styles.sidebarNav}>
              <div className={styles.navItem}>
                <span className={styles.navIcon}>📊</span>
                <span className={styles.navLabel}>Dashboard</span>
              </div>
              <div className={styles.navItem}>
                <span className={styles.navIcon}>💵</span>
                <span className={styles.navLabel}>Earnings</span>
              </div>
              <div className={styles.navItem}>
                <span className={styles.navIcon}>👥</span>
                <span className={styles.navLabel}>Top Fans</span>
              </div>
              <div className={styles.navItem}>
                <span className={styles.navIcon}>📹</span>
                <span className={styles.navLabel}>Sessions</span>
              </div>
              <div className={styles.navItem}>
                <span className={styles.navIcon}>⚙️</span>
                <span className={styles.navLabel}>Settings</span>
              </div>
            </nav>

            <button className={styles.upgradeButtonSidebar}>
              🎁 Upgrade to Pro
            </button>
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className={styles.mainContent}>
          {/* HEADER */}
          <header className={styles.dashboardHeader}>
            <div className={styles.headerContent}>
              <div>
                <h1 className={styles.pageTitle}>Dashboard</h1>
                <p className={styles.pageSubtitle}>
                  September 2024 • Real-time analytics across all platforms
                </p>
              </div>
              <div className={styles.headerActions}>
                <button className={styles.btnSecondary}>Share Report</button>
                <button className={styles.btnPrimary}>Download Data</button>
              </div>
            </div>
          </header>

          {/* ANALYTICS SECTION */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Key Metrics This Month</h2>
            <div className={styles.metricsGrid}>
              {analyticsMetrics.map((metric, idx) => (
                <div key={idx} className={styles.metricCard}>
                  <div className={styles.metricLabel}>{metric.label}</div>
                  <div className={styles.metricValue}>{metric.value}</div>
                  <div className={styles.metricChange}>{metric.change}</div>
                </div>
              ))}
            </div>
          </section>

          {/* INTELLIGENCE CARD */}
          <section className={styles.section}>
            <div className={styles.intelligenceCard}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>💡 Creator Intelligence</h3>
                <span className={styles.badge}>AI Powered</span>
              </div>
              <p className={styles.cardBody}>
                Your peak earning window is <strong>10 PM - 2 AM UTC</strong> on
                Chaturbate. Consider scheduling longer streams during this
                window. Your tip conversion rate (3.2%) is 18% above average for
                your category.
              </p>
              <div className={styles.cardAction}>
                <a href="#" className={styles.linkCyan}>
                  View detailed insights →
                </a>
              </div>
            </div>
          </section>

          {/* REVENUE BY PLATFORM */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Revenue by Platform</h2>
            <div className={styles.platformsGrid}>
              {platforms.map((platform, idx) => (
                <div key={idx} className={styles.platformCard}>
                  <div className={styles.platformHeader}>
                    <span className={styles.platformName}>{platform.name}</span>
                    <span className={styles.percentageBadge}>
                      {platform.percentage}%
                    </span>
                  </div>
                  <div className={styles.platformValue}>${platform.earnings}</div>
                  <div className={styles.platformMeta}>
                    <span>{platform.tokens} tokens @ ${platform.rate}</span>
                    <span className={styles.textMuted}>{platform.hours} hrs</span>
                  </div>
                  <div className={styles.progressBar}>
                    <div
                      className={styles.progressFill}
                      style={{ width: `${platform.percentage}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* TOP FANS SECTION */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Top Supporters</h2>
            <div className={styles.fansTable}>
              <div className={styles.tableHeader}>
                <div className={styles.tableCol1}>Fan Name</div>
                <div className={styles.tableCol2}>Total Tips</div>
                <div className={styles.tableCol3}>Sessions</div>
                <div className={styles.tableCol4}>Favorite Show</div>
              </div>
              {topFans.map((fan, idx) => (
                <div key={idx} className={styles.tableRow}>
                  <div className={styles.tableCol1}>
                    <div className={styles.fanAvatar}>👤</div>
                    <span className={styles.fanName}>{fan.name}</span>
                  </div>
                  <div className={styles.tableCol2}>
                    <span className={styles.tipAmount}>${fan.tips}</span>
                  </div>
                  <div className={styles.tableCol3}>{fan.sessions}</div>
                  <div className={styles.tableCol4}>
                    <span className={styles.showTag}>{fan.favorite}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* SESSIONS ACTIVITY */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Recent Sessions</h2>
            <div className={styles.sessionsTable}>
              <div className={styles.tableHeader}>
                <div className={styles.sessionCol1}>Platform</div>
                <div className={styles.sessionCol2}>Date & Time</div>
                <div className={styles.sessionCol3}>Duration</div>
                <div className={styles.sessionCol4}>Earnings</div>
                <div className={styles.sessionCol5}>Viewers</div>
              </div>
              {recentSessions.map((session) => (
                <div key={session.id} className={styles.tableRow}>
                  <div className={styles.sessionCol1}>
                    <span className={styles.platformBadge}>
                      {session.platform}
                    </span>
                  </div>
                  <div className={styles.sessionCol2}>{session.date}</div>
                  <div className={styles.sessionCol3}>{session.duration}</div>
                  <div className={styles.sessionCol4}>
                    <span className={styles.earnings}>
                      ${session.earnings}
                    </span>
                  </div>
                  <div className={styles.sessionCol5}>{session.viewers}</div>
                </div>
              ))}
            </div>
          </section>

          {/* UPGRADE CTA SECTION */}
          <section className={styles.section}>
            <div className={styles.upgradeCard}>
              <div className={styles.upgradeContent}>
                <h3 className={styles.upgradeTitle}>Unlock Premium Analytics</h3>
                <p className={styles.upgradeDescription}>
                  Get detailed viewer insights, predictive analytics, and
                  dedicated fan support tools. Upgrade to CamCash Pro today.
                </p>
              </div>
              <button
                className={styles.btnUpgrade}
                onClick={() => setShowUpgradeModal(true)}
              >
                Start Free Trial
              </button>
            </div>
          </section>

          {/* EMPTY SPACE FOR BREATHING ROOM */}
          <div style={{ height: "40px" }}></div>
        </main>
      </div>

      {/* UPGRADE MODAL */}
      {showUpgradeModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalShell}>
            <div className={styles.modal}>
              <button
                className={styles.modalClose}
                onClick={() => setShowUpgradeModal(false)}
              >
                ✕
              </button>
              <div className={styles.modalContent}>
                <h2 className={styles.modalTitle}>CamCash Pro</h2>
                <p className={styles.modalBody}>
                  Unlock advanced analytics, predictive insights, and dedicated
                  creator support.
                </p>
                <div className={styles.featuresList}>
                  <div className={styles.feature}>✓ Viewer behavioral analytics</div>
                  <div className={styles.feature}>✓ Peak earning predictions</div>
                  <div className={styles.feature}>✓ Fan relationship manager</div>
                  <div className={styles.feature}>✓ Platform revenue optimizer</div>
                </div>
                <button
                  className={styles.btnPrimary}
                  onClick={() => setShowUpgradeModal(false)}
                >
                  Start 14-Day Free Trial
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DashboardPlayground
