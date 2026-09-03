"use client"
import React, { useState } from "react"
import styles from "./playground.module.css"

const Playground = () => {
  const [activeTab, setActiveTab] = useState("components")
  const [selectedFan, setSelectedFan] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  return (
    <div className={styles.playgroundContainer}>
      {/* HEADER */}
      <header className={styles.playgroundHeader}>
        <div className={styles.headerContent}>
          <div>
            <h1 className={styles.pageTitle}>CamCash UI Playground</h1>
            <p className={styles.pageSubtitle}>
              Premium • Dark • Feminine • Sophisticated Design System
            </p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.btnSecondary}>Docs</button>
            <button className={styles.btnPrimary}>Export Tokens</button>
          </div>
        </div>
      </header>

      <div className={styles.playgroundBody}>
        {/* NAVIGATION TABS */}
        <nav className={styles.navTabs}>
          {["components", "patterns", "typography", "spacing"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`${styles.navTab} ${activeTab === tab ? styles.active : ""}`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>

        {/* CONTENT SECTIONS */}
        <main className={styles.playgroundContent}>
          {activeTab === "components" && (
            <div className={styles.componentsSection}>
              {/* KPI CARDS */}
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>KPI Cards</h2>
                <div className={styles.componentGrid}>
                  <div className={styles.kpiCard}>
                    <div className={styles.kpiLabel}>Total Earnings</div>
                    <div className={styles.kpiValue}>$12,485</div>
                    <div className={styles.kpiSubtext}>This month</div>
                  </div>
                  <div className={styles.kpiCard}>
                    <div className={styles.kpiLabel}>Average $/Hour</div>
                    <div className={styles.kpiValue}>$287</div>
                    <div className={styles.kpiSubtext}>Up 12% from last month</div>
                  </div>
                  <div className={styles.kpiCard}>
                    <div className={styles.kpiLabel}>Total Tips</div>
                    <div className={styles.kpiValue}>$4,320</div>
                    <div className={styles.kpiSubtext}>From 156 unique fans</div>
                  </div>
                  <div className={styles.kpiCard}>
                    <div className={styles.kpiLabel}>Streaming Hours</div>
                    <div className={styles.kpiValue}>48.5h</div>
                    <div className={styles.kpiSubtext}>Across 3 platforms</div>
                  </div>
                </div>
              </section>

              {/* REVENUE BREAKDOWN CARDS */}
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Revenue Cards</h2>
                <div className={styles.componentGrid}>
                  <div className={styles.revenueCard}>
                    <div className={styles.revenueHeader}>
                      <span className={styles.platformLabel}>Chaturbate</span>
                      <span className={styles.badge}>42%</span>
                    </div>
                    <div className={styles.revenueValue}>$5,240</div>
                    <div className={styles.revenueMeta}>
                      <span>185 tokens @ $0.05</span>
                      <span className={styles.textMuted}>12.5 hrs</span>
                    </div>
                    <div className={styles.progressBar}>
                      <div className={styles.progressFill} style={{ width: "42%" }}></div>
                    </div>
                  </div>
                  <div className={styles.revenueCard}>
                    <div className={styles.revenueHeader}>
                      <span className={styles.platformLabel}>MyFreeCams</span>
                      <span className={styles.badge}>35%</span>
                    </div>
                    <div className={styles.revenueValue}>$4,385</div>
                    <div className={styles.revenueMeta}>
                      <span>8,740 tokens @ $0.50</span>
                      <span className={styles.textMuted}>14.2 hrs</span>
                    </div>
                    <div className={styles.progressBar}>
                      <div className={styles.progressFill} style={{ width: "35%" }}></div>
                    </div>
                  </div>
                  <div className={styles.revenueCard}>
                    <div className={styles.revenueHeader}>
                      <span className={styles.platformLabel}>BongaCams</span>
                      <span className={styles.badge}>23%</span>
                    </div>
                    <div className={styles.revenueValue}>$2,860</div>
                    <div className={styles.revenueMeta}>
                      <span>91,200 tokens @ $0.03</span>
                      <span className={styles.textMuted}>21.8 hrs</span>
                    </div>
                    <div className={styles.progressBar}>
                      <div className={styles.progressFill} style={{ width: "23%" }}></div>
                    </div>
                  </div>
                </div>
              </section>

              {/* PLATFORM CARDS */}
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Platform Performance Cards</h2>
                <div className={styles.componentGrid}>
                  <div className={`${styles.platformCard} ${styles.platformHot}`}>
                    <div className={styles.platformName}>Chaturbate</div>
                    <div className={styles.platformStat}>
                      <span>Revenue</span>
                      <strong>$5,240</strong>
                    </div>
                    <div className={styles.platformStat}>
                      <span>Avg $/Hr</span>
                      <strong>$418</strong>
                    </div>
                    <button className={styles.btnTiny}>View Details</button>
                  </div>
                  <div className={`${styles.platformCard} ${styles.platformWarm}`}>
                    <div className={styles.platformName}>MyFreeCams</div>
                    <div className={styles.platformStat}>
                      <span>Revenue</span>
                      <strong>$4,385</strong>
                    </div>
                    <div className={styles.platformStat}>
                      <span>Avg $/Hr</span>
                      <strong>$309</strong>
                    </div>
                    <button className={styles.btnTiny}>View Details</button>
                  </div>
                  <div className={`${styles.platformCard} ${styles.platformCool}`}>
                    <div className={styles.platformName}>BongaCams</div>
                    <div className={styles.platformStat}>
                      <span>Revenue</span>
                      <strong>$2,860</strong>
                    </div>
                    <div className={styles.platformStat}>
                      <span>Avg $/Hr</span>
                      <strong>$131</strong>
                    </div>
                    <button className={styles.btnTiny}>View Details</button>
                  </div>
                </div>
              </section>

              {/* FAN CARDS */}
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Top Fan Cards</h2>
                <div className={styles.fanGrid}>
                  <div className={styles.fanCard}>
                    <div className={styles.fanCardHeader}>
                      <div className={styles.fanAvatar}>💎</div>
                      <div className={styles.fanInfo}>
                        <strong>Whale_King</strong>
                        <span className={styles.fanTier}>Whale Tier</span>
                      </div>
                    </div>
                    <div className={styles.fanStats}>
                      <div className={styles.fanStat}>
                        <span>Total Spent</span>
                        <strong>$8,450</strong>
                      </div>
                      <div className={styles.fanStat}>
                        <span>Avg Tip</span>
                        <strong>$340</strong>
                      </div>
                    </div>
                    <div className={styles.fanMeta}>
                      <span className={styles.platform}>Chaturbate</span>
                      <span className={styles.risk}>Last visit: 2 days ago</span>
                    </div>
                    <button className={styles.btnGradient}>Engage Fan</button>
                  </div>

                  <div className={styles.fanCard}>
                    <div className={styles.fanCardHeader}>
                      <div className={styles.fanAvatar}>🔥</div>
                      <div className={styles.fanInfo}>
                        <strong>Purple_Passion</strong>
                        <span className={styles.fanTierShark}>Shark Tier</span>
                      </div>
                    </div>
                    <div className={styles.fanStats}>
                      <div className={styles.fanStat}>
                        <span>Total Spent</span>
                        <strong>$3,280</strong>
                      </div>
                      <div className={styles.fanStat}>
                        <span>Avg Tip</span>
                        <strong>$145</strong>
                      </div>
                    </div>
                    <div className={styles.fanMeta}>
                      <span className={styles.platform}>MyFreeCams</span>
                      <span className={styles.warning}>Heating up 🔥</span>
                    </div>
                    <button className={styles.btnGradient}>Engage Fan</button>
                  </div>

                  <div className={styles.fanCard}>
                    <div className={styles.fanCardHeader}>
                      <div className={styles.fanAvatar}>👤</div>
                      <div className={styles.fanInfo}>
                        <strong>SkyDreamer</strong>
                        <span className={styles.fanTierRegular}>Regular Fan</span>
                      </div>
                    </div>
                    <div className={styles.fanStats}>
                      <div className={styles.fanStat}>
                        <span>Total Spent</span>
                        <strong>$420</strong>
                      </div>
                      <div className={styles.fanStat}>
                        <span>Avg Tip</span>
                        <strong>$32</strong>
                      </div>
                    </div>
                    <div className={styles.fanMeta}>
                      <span className={styles.platform}>BongaCams</span>
                      <span className={styles.textMuted}>Active this week</span>
                    </div>
                    <button className={styles.btnGradient}>Engage Fan</button>
                  </div>
                </div>
              </section>

              {/* SESSION CARDS */}
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Session Cards</h2>
                <div className={styles.sessionGrid}>
                  <div className={styles.sessionCard}>
                    <div className={styles.sessionHeader}>
                      <span className={styles.sessionDate}>Today • 2:15 PM</span>
                      <span className={styles.badge}>+$840</span>
                    </div>
                    <div className={styles.sessionTitle}>Peak Hour Performance</div>
                    <div className={styles.sessionMeta}>
                      <span>45 min • Chaturbate</span>
                      <span className={styles.sessionRate}>$1,120/hr</span>
                    </div>
                    <div className={styles.sessionStats}>
                      <div>
                        <span>Tips</span>
                        <strong>24</strong>
                      </div>
                      <div>
                        <span>Avg Tip</span>
                        <strong>$35</strong>
                      </div>
                      <div>
                        <span>Viewers</span>
                        <strong>47</strong>
                      </div>
                    </div>
                  </div>

                  <div className={styles.sessionCard}>
                    <div className={styles.sessionHeader}>
                      <span className={styles.sessionDate}>Yesterday • 8:45 PM</span>
                      <span className={styles.badge}>+$1,240</span>
                    </div>
                    <div className={styles.sessionTitle}>High Engagement Session</div>
                    <div className={styles.sessionMeta}>
                      <span>92 min • MyFreeCams</span>
                      <span className={styles.sessionRate}>$810/hr</span>
                    </div>
                    <div className={styles.sessionStats}>
                      <div>
                        <span>Tips</span>
                        <strong>68</strong>
                      </div>
                      <div>
                        <span>Avg Tip</span>
                        <strong>$18</strong>
                      </div>
                      <div>
                        <span>Viewers</span>
                        <strong>124</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* DATA TABLE */}
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Data Table</h2>
                <div className={styles.tableContainer}>
                  <table className={styles.dataTable}>
                    <thead>
                      <tr>
                        <th>Platform</th>
                        <th>Date</th>
                        <th>Revenue</th>
                        <th>Hours</th>
                        <th>Avg $/Hr</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>
                          <span className={styles.platformBadge}>Chaturbate</span>
                        </td>
                        <td>Sep 3, 2026</td>
                        <td>$520</td>
                        <td>1.25 hrs</td>
                        <td className={styles.positive}>$416</td>
                        <td>
                          <span className={`${styles.badge} ${styles.badgeGreen}`}>
                            Active
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <span className={styles.platformBadge}>MyFreeCams</span>
                        </td>
                        <td>Sep 3, 2026</td>
                        <td>$340</td>
                        <td>0.85 hrs</td>
                        <td className={styles.positive}>$400</td>
                        <td>
                          <span className={`${styles.badge} ${styles.badgeYellow}`}>
                            Low
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <span className={styles.platformBadge}>BongaCams</span>
                        </td>
                        <td>Sep 2, 2026</td>
                        <td>$180</td>
                        <td>2.1 hrs</td>
                        <td className={styles.negative}>$86</td>
                        <td>
                          <span className={`${styles.badge} ${styles.badgeGray}`}>
                            Offline
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              {/* BUTTONS */}
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Buttons</h2>
                <div className={styles.componentGrid}>
                  <div>
                    <p className={styles.componentLabel}>Primary</p>
                    <button className={styles.btnPrimary}>Start Session</button>
                  </div>
                  <div>
                    <p className={styles.componentLabel}>Secondary</p>
                    <button className={styles.btnSecondary}>Cancel</button>
                  </div>
                  <div>
                    <p className={styles.componentLabel}>Gradient</p>
                    <button className={styles.btnGradient}>Unlock Pro</button>
                  </div>
                  <div>
                    <p className={styles.componentLabel}>Danger</p>
                    <button className={styles.btnDanger}>Delete</button>
                  </div>
                </div>
              </section>

              {/* INPUTS & FORMS */}
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Form Elements</h2>
                <div className={styles.formGrid}>
                  <div>
                    <label className={styles.formLabel}>Email</label>
                    <input
                      type="email"
                      placeholder="you@example.com"
                      className={styles.formInput}
                    />
                  </div>
                  <div>
                    <label className={styles.formLabel}>Select Platform</label>
                    <select className={styles.formSelect}>
                      <option>Chaturbate</option>
                      <option>MyFreeCams</option>
                      <option>BongaCams</option>
                    </select>
                  </div>
                  <div>
                    <label className={styles.formLabel}>Search Fans</label>
                    <input
                      type="text"
                      placeholder="Search username..."
                      className={styles.formInput}
                    />
                  </div>
                </div>
              </section>

              {/* BADGES & INDICATORS */}
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Badges & Status Indicators</h2>
                <div className={styles.badgeGrid}>
                  <span className={`${styles.badge} ${styles.badgeGreen}`}>Active</span>
                  <span className={`${styles.badge} ${styles.badgeYellow}`}>Heating Up</span>
                  <span className={`${styles.badge} ${styles.badgeRed}`}>Critical</span>
                  <span className={`${styles.badge} ${styles.badgePurple}`}>Whale</span>
                  <span className={`${styles.badge} ${styles.badgeCyan}`}>Pro</span>
                  <span className={`${styles.badge} ${styles.badgeGray}`}>Offline</span>
                </div>
              </section>

              {/* ALERTS */}
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Alerts</h2>
                <div className={styles.alertGrid}>
                  <div className={`${styles.alert} ${styles.alertSuccess}`}>
                    ✓ Session saved successfully
                  </div>
                  <div className={`${styles.alert} ${styles.alertWarning}`}>
                    ⚠ You're below your daily earnings goal
                  </div>
                  <div className={`${styles.alert} ${styles.alertError}`}>
                    ✕ Connection lost. Retrying...
                  </div>
                  <div className={`${styles.alert} ${styles.alertInfo}`}>
                    ℹ New fan joined your room
                  </div>
                </div>
              </section>

              {/* EMPTY STATES */}
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Empty States</h2>
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>📊</div>
                  <h3>No Data Yet</h3>
                  <p>Start streaming to see your analytics</p>
                  <button className={styles.btnPrimary}>Start Session</button>
                </div>
              </section>

              {/* UPGRADE / PAYWALL CARDS */}
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Upgrade & Paywall Cards</h2>
                <div className={styles.upgradeCard}>
                  <div className={styles.upgradeBadge}>Pro Feature</div>
                  <h3>Unlock Your Full Fan Insights</h3>
                  <p>See your complete fan list, predict churn, and engage strategically</p>
                  <ul className={styles.upgradeFeatures}>
                    <li>✓ Unlimited fan tracking</li>
                    <li>✓ Churn risk predictions</li>
                    <li>✓ Re-engagement recommendations</li>
                    <li>✓ Fan lifetime value</li>
                  </ul>
                  <button className={styles.btnGradient}>Upgrade to Pro</button>
                </div>
              </section>

              {/* PROGRESS INDICATORS */}
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Progress & Loading</h2>
                <div className={styles.progressGrid}>
                  <div>
                    <p className={styles.componentLabel}>Progress Bar</p>
                    <div className={styles.progressBar}>
                      <div className={styles.progressFill} style={{ width: "75%" }}></div>
                    </div>
                    <small>75% Complete</small>
                  </div>
                  <div>
                    <p className={styles.componentLabel}>Loading Spinner</p>
                    <div className={styles.spinner}></div>
                  </div>
                </div>
              </section>

              {/* MODALS & OVERLAYS */}
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Modals & Dialogs</h2>
                <button
                  className={styles.btnPrimary}
                  onClick={() => setShowModal(true)}
                >
                  Open Modal Example
                </button>

                {showModal && (
                  <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
                    <div
                      className={styles.modalContent}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <h3>Confirm Action</h3>
                      <p>
                        Are you sure you want to export your earnings data? This action
                        cannot be undone.
                      </p>
                      <div className={styles.modalActions}>
                        <button
                          className={styles.btnSecondary}
                          onClick={() => setShowModal(false)}
                        >
                          Cancel
                        </button>
                        <button
                          className={styles.btnGradient}
                          onClick={() => setShowModal(false)}
                        >
                          Export
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* TOOLTIPS */}
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Tooltips</h2>
                <div className={styles.tooltipContainer}>
                  <span className={styles.tooltipTrigger}>
                    Hover for info 💡
                    <span className={styles.tooltip}>
                      This shows a tooltip with additional context
                    </span>
                  </span>
                </div>
              </section>

              {/* TABS */}
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Tabs</h2>
                <div className={styles.tabsContainer}>
                  <button className={`${styles.tabButton} ${styles.active}`}>
                    Overview
                  </button>
                  <button className={styles.tabButton}>Analytics</button>
                  <button className={styles.tabButton}>Settings</button>
                </div>
                <div className={styles.tabContent}>Tab content goes here</div>
              </section>

              {/* GLASSMORPHISM & GRADIENTS */}
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Glassmorphism & Gradients</h2>
                <div className={styles.glassGrid}>
                  <div className={styles.glassCard}>
                    <h4>Frosted Glass</h4>
                    <p>Subtle backdrop blur with semi-transparent background</p>
                  </div>
                  <div className={styles.gradientCard}>
                    <h4>Gradient Accent</h4>
                    <p>Cyan to pink luminous gradient</p>
                  </div>
                  <div className={styles.neonCard}>
                    <h4>Neon Glow</h4>
                    <p>Ethereal neon cyan and pink glow</p>
                  </div>
                </div>
              </section>

              {/* HOVER STATES */}
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Interactive States</h2>
                <div className={styles.componentGrid}>
                  <div className={styles.hoverCard}>
                    <p>Hover me</p>
                    <small>Watch the glow intensify</small>
                  </div>
                  <div className={styles.pressCard}>
                    <p>Press me</p>
                    <small>Watch the gradient shift</small>
                  </div>
                </div>
              </section>

              {/* ANIMATIONS */}
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Animations</h2>
                <div className={styles.animationGrid}>
                  <div className={styles.fadeInBox}>Fade In</div>
                  <div className={styles.slideInBox}>Slide In</div>
                  <div className={styles.pulseBox}>Pulse</div>
                  <div className={styles.glowBox}>Glow</div>
                </div>
              </section>
            </div>
          )}

          {activeTab === "patterns" && (
            <div className={styles.patternsSection}>
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Dashboard Layout Pattern</h2>
                <div className={styles.layoutPreview}>
                  <div className={styles.layoutSidebar}>Sidebar</div>
                  <div className={styles.layoutMain}>
                    <div className={styles.layoutHeader}>Header</div>
                    <div className={styles.layoutContent}>
                      <div className={styles.statChip}>KPI</div>
                      <div className={styles.statChip}>KPI</div>
                      <div className={styles.statChip}>KPI</div>
                    </div>
                  </div>
                </div>
              </section>

              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Card Grid Patterns</h2>
                <p className={styles.sectionDesc}>
                  Adaptive 3-column grid for fans, 2-column for revenue breakdown
                </p>
                <div className={styles.patternGrid}>
                  <div className={styles.patternCard}>3-Col Grid</div>
                  <div className={styles.patternCard}>3-Col Grid</div>
                  <div className={styles.patternCard}>3-Col Grid</div>
                </div>
              </section>
            </div>
          )}

          {activeTab === "typography" && (
            <div className={styles.typographySection}>
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Typography System</h2>

                <div className={styles.typographyItem}>
                  <h1 className={styles.h1}>H1: Page Title - Syne Bold</h1>
                  <p className={styles.typoNote}>34px • Weight 800 • Line 1.1</p>
                </div>

                <div className={styles.typographyItem}>
                  <h2 className={styles.h2}>H2: Section Heading</h2>
                  <p className={styles.typoNote}>22px • Weight 750 • Line 1.2</p>
                </div>

                <div className={styles.typographyItem}>
                  <h3 className={styles.h3}>H3: Card Title</h3>
                  <p className={styles.typoNote}>18px • Weight 700 • Line 1.3</p>
                </div>

                <div className={styles.typographyItem}>
                  <p className={styles.bodyLarge}>
                    Body Large: Main content paragraph with proper hierarchy
                  </p>
                  <p className={styles.typoNote}>15px • Weight 400 • Line 1.6</p>
                </div>

                <div className={styles.typographyItem}>
                  <p className={styles.bodyRegular}>
                    Body Regular: Standard text for descriptions and metadata
                  </p>
                  <p className={styles.typoNote}>14px • Weight 400 • Line 1.5</p>
                </div>

                <div className={styles.typographyItem}>
                  <small className={styles.textSmall}>
                    Small: Helper text, labels, and secondary information
                  </small>
                  <p className={styles.typoNote}>12px • Weight 400 • Line 1.4</p>
                </div>

                <div className={styles.typographyItem}>
                  <code className={styles.monospace}>
                    font-family: 'Syne', 'Space Grotesk', sans-serif
                  </code>
                  <p className={styles.typoNote}>Monospace for code</p>
                </div>

                <h3 className={styles.h3} style={{ marginTop: "30px" }}>
                  Color Palette
                </h3>
                <div className={styles.colorGrid}>
                  <div className={styles.colorSwatch}>
                    <div className={styles.swatchPrimary}></div>
                    <small>Cyan #20DDF5</small>
                  </div>
                  <div className={styles.colorSwatch}>
                    <div className={styles.swatchSecondary}></div>
                    <small>Pink #EC3BAF</small>
                  </div>
                  <div className={styles.colorSwatch}>
                    <div className={styles.swatchPurple}></div>
                    <small>Purple #8060F5</small>
                  </div>
                  <div className={styles.colorSwatch}>
                    <div className={styles.swatchSuccess}></div>
                    <small>Green #17D89A</small>
                  </div>
                  <div className={styles.colorSwatch}>
                    <div className={styles.swatchWarning}></div>
                    <small>Gold #F5A400</small>
                  </div>
                  <div className={styles.colorSwatch}>
                    <div className={styles.swatchError}></div>
                    <small>Red #FF6B73</small>
                  </div>
                </div>
              </section>
            </div>
          )}

          {activeTab === "spacing" && (
            <div className={styles.spacingSection}>
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Spacing Scale</h2>
                <p className={styles.sectionDesc}>
                  Consistent spacing system for rhythm and hierarchy
                </p>

                <div className={styles.spacingGrid}>
                  <div>
                    <div className={styles.spacingBox} style={{ height: "4px" }}></div>
                    <small>xs: 4px</small>
                  </div>
                  <div>
                    <div className={styles.spacingBox} style={{ height: "8px" }}></div>
                    <small>sm: 8px</small>
                  </div>
                  <div>
                    <div className={styles.spacingBox} style={{ height: "12px" }}></div>
                    <small>md: 12px</small>
                  </div>
                  <div>
                    <div className={styles.spacingBox} style={{ height: "16px" }}></div>
                    <small>lg: 16px</small>
                  </div>
                  <div>
                    <div className={styles.spacingBox} style={{ height: "20px" }}></div>
                    <small>xl: 20px</small>
                  </div>
                  <div>
                    <div className={styles.spacingBox} style={{ height: "24px" }}></div>
                    <small>2xl: 24px</small>
                  </div>
                  <div>
                    <div className={styles.spacingBox} style={{ height: "32px" }}></div>
                    <small>3xl: 32px</small>
                  </div>
                  <div>
                    <div className={styles.spacingBox} style={{ height: "40px" }}></div>
                    <small>4xl: 40px</small>
                  </div>
                </div>

                <h3 className={styles.h3} style={{ marginTop: "40px" }}>
                  Border Radius Scale
                </h3>
                <div className={styles.radiusGrid}>
                  <div>
                    <div
                      className={styles.radiusBox}
                      style={{ borderRadius: "4px" }}
                    ></div>
                    <small>xs: 4px</small>
                  </div>
                  <div>
                    <div
                      className={styles.radiusBox}
                      style={{ borderRadius: "8px" }}
                    ></div>
                    <small>sm: 8px</small>
                  </div>
                  <div>
                    <div
                      className={styles.radiusBox}
                      style={{ borderRadius: "12px" }}
                    ></div>
                    <small>md: 12px</small>
                  </div>
                  <div>
                    <div
                      className={styles.radiusBox}
                      style={{ borderRadius: "16px" }}
                    ></div>
                    <small>lg: 16px</small>
                  </div>
                  <div>
                    <div
                      className={styles.radiusBox}
                      style={{ borderRadius: "20px" }}
                    ></div>
                    <small>xl: 20px</small>
                  </div>
                  <div>
                    <div
                      className={styles.radiusBox}
                      style={{ borderRadius: "999px" }}
                    ></div>
                    <small>full: 999px</small>
                  </div>
                </div>
              </section>
            </div>
          )}
        </main>
      </div>

      {/* FOOTER */}
      <footer className={styles.playgroundFooter}>
        <p>CamCash UI Playground • Design System v1.0</p>
        <p>For design iteration and approval only</p>
      </footer>
    </div>
  )
}

export default Playground
