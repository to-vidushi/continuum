'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import {
  getAllReviews, getCurrentWeekStart, getWeekEnd,
  formatWeekRange, WeeklyReview,
} from '@/lib/weeklyReview'
import styles from './WeeklyReview.module.css'

// ── Mood config ────────────────────────────────────────────────────────────

const MOOD_CONFIG = {
  heavy:     { label: 'Heavy',     emoji: '🌧️', color: '#5b7fe8', bg: '#f0f4ff' },
  neutral:   { label: 'Neutral',   emoji: '⛅',  color: '#d4a017', bg: '#fffbf0' },
  energised: { label: 'Energised', emoji: '☀️',  color: '#4a9e6b', bg: '#f2fbf5' },
}

// ── Score ring ─────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 100 }: { score: number; size?: number }) {
  const r      = (size - 16) / 2
  const circ   = 2 * Math.PI * r
  const filled = (score / 100) * circ
  const color  = score >= 70 ? '#4a9e6b' : score >= 40 ? '#d4a017' : '#e8736c'
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', display: 'block', flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f0ede8" strokeWidth={8} />
      <circle
        cx={size/2} cy={size/2} r={r}
        fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.7s ease' }}
      />
      <text
        x="50%" y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        style={{
          transform: 'rotate(90deg)',
          transformOrigin: '50% 50%',
          fill: '#1a1a18',
          fontSize: size * 0.24,
          fontWeight: 700,
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        {score}
      </text>
    </svg>
  )
}

// ── Review section card ────────────────────────────────────────────────────

function ReviewSection({ icon, title, text, delay }: {
  icon: string; title: string; text: string; delay: string
}) {
  return (
    <div className={styles.section} style={{ animationDelay: delay }}>
      <div className={styles.sectionHead}>
        <span className={styles.sectionIcon}>{icon}</span>
        <span className={styles.sectionTitle}>{title}</span>
      </div>
      <p className={styles.sectionText}>{text}</p>
    </div>
  )
}

// ── Stat bar ───────────────────────────────────────────────────────────────

function StatBar({ label, done, total, color }: {
  label: string; done: number; total: number; color: string
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div className={styles.statBarItem}>
      <div className={styles.statBarTop}>
        <span className={styles.statBarLabel}>{label}</span>
        <span className={styles.statBarRight}>
          <span className={styles.statBarFrac}>{done}/{total}</span>
          <span className={styles.statBarPct} style={{ color }}>{pct}%</span>
        </span>
      </div>
      <div className={styles.statBarBg}>
        <div className={styles.statBarFill} style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function WeeklyReviewPage() {
  const router = useRouter()

  const [userId, setUserId]             = useState('')
  const [reviews, setReviews]           = useState<WeeklyReview[]>([])
  const [loading, setLoading]           = useState(true)
  const [generating, setGenerating]     = useState(false)
  const [error, setError]               = useState('')
  const [expandedPast, setExpandedPast] = useState<string | null>(null)
  const [liveStats, setLiveStats]       = useState<{
    habitsDone: number; habitsTotal: number
    winsDone: number;   winsTotal: number
    journalDays: number; challengeCheckins: number
    weekScore: number
  } | null>(null)

  const weekStart = getCurrentWeekStart()
  const weekEnd   = getWeekEnd(weekStart)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }
      setUserId(user.id)
      const data = await getAllReviews()
      setReviews(data)
      setLoading(false)
    }
    init()
  }, [router])

  const currentReview = reviews.find(r => r.week_start === weekStart) ?? null
  const pastReviews   = reviews.filter(r => r.week_start !== weekStart)
  const prevReview    = pastReviews[0] ?? null
  const scoreDelta    = currentReview && prevReview
    ? currentReview.week_score - prevReview.week_score
    : null

  async function generateReview() {
    if (!userId) return
    setGenerating(true)
    setError('')
    try {
      const res = await fetch('/api/weekly-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, weekStart }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Something went wrong.')
        return
      }
      const { review, stats } = await res.json()
      setReviews(prev => [review, ...prev.filter(r => r.week_start !== weekStart)])
      setLiveStats(stats)
    } catch (e) {
      setError(String(e))
    } finally {
      setGenerating(false)
    }
  }

  const sidebarStats = liveStats ?? (currentReview ? {
    weekScore:         currentReview.week_score,
    habitsDone: 0, habitsTotal: 0,
    winsDone:   0, winsTotal:   0,
    journalDays: 0, challengeCheckins: 0,
  } : null)

  if (loading) {
    return (
      <div className={styles.loadingWrap}>
        <div className={styles.loadingDots}><span /><span /><span /></div>
      </div>
    )
  }

  const moodCfg = currentReview
    ? (MOOD_CONFIG[currentReview.mood] ?? MOOD_CONFIG.neutral)
    : null

  return (
    <div className={styles.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');`}</style>

      {/* ── Header ── */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.heading}>Weekly Review</h1>
          <p className={styles.subheading}>{formatWeekRange(weekStart, weekEnd)}</p>
        </div>
        <button
          className={`${styles.generateBtn} ${generating ? styles.generateBtnLoading : ''}`}
          onClick={generateReview}
          disabled={generating}
        >
          {generating
            ? <><span className={styles.spinner} />Generating…</>
            : currentReview ? '↺ Regenerate' : '✦ Generate Review'
          }
        </button>
      </div>

      {error && <div className={styles.errorBanner}>⚠ {error}</div>}

      {/* ── Two-column body ── */}
      <div className={styles.body}>

        {/* ════ LEFT ════ */}
        <div className={styles.reviewCol}>

          {/* Empty state */}
          {!currentReview && !generating && (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>🗓️</div>
              <div className={styles.emptyTitle}>No review yet this week</div>
              <div className={styles.emptySub}>
                Generate your AI-powered weekly reflection based on your wins,
                habits, journal entries and challenges.
              </div>
              <button className={styles.emptyBtn} onClick={generateReview}>
                ✦ Generate my review
              </button>
            </div>
          )}

          {/* Skeleton while generating */}
          {generating && (
            <div className={styles.reviewCard}>
              <div className={styles.skeletonTopRow}>
                <div className={styles.skeletonRing} />
                <div className={styles.skeletonMood} />
                <div style={{ flex: 1 }} />
                <div className={styles.skeletonChip} />
              </div>
              {[1,2,3,4].map(i => (
                <div key={i} className={styles.skeletonSection}>
                  <div className={styles.skeletonTitle} />
                  <div className={styles.skeletonLine} />
                  <div className={styles.skeletonLine} style={{ width: '72%' }} />
                </div>
              ))}
            </div>
          )}

          {/* Review */}
          {currentReview && !generating && (
            <div className={styles.reviewCard}>

              {/* Top meta row: ring | mood | spacer | timestamp */}
              <div className={styles.metaRow}>
                {/* Score ring + label */}
                <div className={styles.ringBlock}>
                  <ScoreRing score={currentReview.week_score} size={100} />
                  <div className={styles.ringMeta}>
                    <span className={styles.ringLabel}>Week score</span>
                    {scoreDelta !== null && (
                      <span className={`${styles.delta} ${scoreDelta >= 0 ? styles.deltaPos : styles.deltaNeg}`}>
                        {scoreDelta >= 0 ? `+${scoreDelta}` : scoreDelta} vs last week
                      </span>
                    )}
                  </div>
                </div>

                {/* Mood card */}
                {moodCfg && (
                  <div className={styles.moodCard} style={{ background: moodCfg.bg, borderColor: moodCfg.color + '40' }}>
                    <span className={styles.moodEmoji}>{moodCfg.emoji}</span>
                    <div>
                      <div className={styles.moodLabel} style={{ color: moodCfg.color }}>{moodCfg.label}</div>
                      <div className={styles.moodSub}>Week mood</div>
                    </div>
                  </div>
                )}

                {/* Timestamp pushed to right */}
                <div className={styles.timestamp}>
                  Generated {new Date(currentReview.generated_at).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric',
                  })} at {new Date(currentReview.generated_at).toLocaleTimeString('en-US', {
                    hour: 'numeric', minute: '2-digit', hour12: true,
                  })}
                </div>
              </div>

              {/* Divider */}
              <div className={styles.divider} />

              {/* Sections */}
              <div className={styles.sections}>
                <ReviewSection icon="📋" title="Week in review"    text={currentReview.content.summary}       delay="0s"    />
                <ReviewSection icon="🏆" title="Wins & highlights" text={currentReview.content.wins}          delay="0.07s" />
                <ReviewSection icon="🔍" title="Patterns noticed"  text={currentReview.content.patterns}      delay="0.14s" />
                <ReviewSection icon="→"  title="Carry forward"     text={currentReview.content.carry_forward} delay="0.21s" />
              </div>
            </div>
          )}

          {/* ── Past reviews archive ── */}
          {pastReviews.length > 0 && (
            <div className={styles.archive}>
              <h2 className={styles.archiveHeading}>Past reviews</h2>
              {pastReviews.map((review, idx) => {
                const isOpen = expandedPast === review.id
                const mCfg   = MOOD_CONFIG[review.mood] ?? MOOD_CONFIG.neutral
                const prevR  = pastReviews[idx + 1] ?? null
                const delta  = prevR ? review.week_score - prevR.week_score : null
                return (
                  <div key={review.id} className={styles.archiveItem}>
                    <button
                      className={styles.archiveRow}
                      onClick={() => setExpandedPast(isOpen ? null : review.id)}
                    >
                      <div className={styles.archiveLeft}>
                        <span className={styles.archiveWeek}>{formatWeekRange(review.week_start, review.week_end)}</span>
                        <span className={styles.archiveMoodPill} style={{ background: mCfg.bg, color: mCfg.color }}>
                          {mCfg.emoji} {mCfg.label}
                        </span>
                      </div>
                      <div className={styles.archiveRight}>
                        <span className={styles.archiveScore}>{review.week_score}</span>
                        {delta !== null && (
                          <span className={`${styles.delta} ${delta >= 0 ? styles.deltaPos : styles.deltaNeg}`}>
                            {delta >= 0 ? `+${delta}` : delta}
                          </span>
                        )}
                        <span className={styles.chevron}>{isOpen ? '▴' : '▾'}</span>
                      </div>
                    </button>
                    {isOpen && (
                      <div className={styles.archiveExpanded}>
                        <ReviewSection icon="📋" title="Week in review"    text={review.content.summary}       delay="0s"    />
                        <ReviewSection icon="🏆" title="Wins & highlights" text={review.content.wins}          delay="0.05s" />
                        <ReviewSection icon="🔍" title="Patterns noticed"  text={review.content.patterns}      delay="0.1s"  />
                        <ReviewSection icon="→"  title="Carry forward"     text={review.content.carry_forward} delay="0.15s" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ════ RIGHT: sidebar ════ */}
        <aside className={styles.sidePanel}>

          {/* This week at a glance */}
          <div className={styles.panelCard}>
            <div className={styles.panelTitle}>This week at a glance</div>
            {sidebarStats && (sidebarStats.habitsTotal > 0 || sidebarStats.winsTotal > 0 || sidebarStats.journalDays > 0) ? (
              <>
                <div className={styles.statBars}>
                  <StatBar label="Habits"  done={sidebarStats.habitsDone}  total={sidebarStats.habitsTotal} color="#4a9e6b" />
                  <StatBar label="Wins"    done={sidebarStats.winsDone}    total={sidebarStats.winsTotal}   color="#e8736c" />
                  <StatBar label="Journal" done={sidebarStats.journalDays} total={7}                        color="#3a7bd5" />
                </div>
                <div className={styles.challengeRow}>
                  <span className={styles.challengeLabel}>⚡ Challenge check-ins</span>
                  <span className={styles.challengeVal}>{sidebarStats.challengeCheckins}</span>
                </div>
              </>
            ) : (
              <p className={styles.glancePlaceholder}>
                Generate a review to see this week's breakdown.
              </p>
            )}
          </div>

          {/* Score history */}
          {reviews.length > 1 && (
            <div className={styles.panelCard}>
              <div className={styles.panelTitle}>Score history</div>
              <div className={styles.scoreHistory}>
                {[...reviews].reverse().slice(-6).map(r => {
                  const maxScore = Math.max(...reviews.map(rv => rv.week_score), 1)
                  const h     = Math.max(6, Math.round((r.week_score / maxScore) * 56))
                  const color = r.week_score >= 70 ? '#4a9e6b' : r.week_score >= 40 ? '#d4a017' : '#e8736c'
                  const isCurrent = r.week_start === weekStart
                  return (
                    <div
                      key={r.id}
                      className={`${styles.scoreBar} ${isCurrent ? styles.scoreBarCurrent : ''}`}
                      title={`${formatWeekRange(r.week_start, r.week_end)}: ${r.week_score}`}
                    >
                      <div className={styles.scoreBarNum}>{r.week_score}</div>
                      <div className={styles.scoreBarFill} style={{ height: h, background: color }} />
                      <div className={styles.scoreBarWeek}>
                        {new Date(r.week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className={styles.poweredBy}>
            <span>✦</span>
            <span>Powered by Groq (Llama 3.3) · On demand</span>
          </div>

        </aside>
      </div>
    </div>
  )
}