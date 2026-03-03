'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { getAllEntries, JournalEntry } from '@/lib/journal'
import styles from './Journal.module.css'

function formatFullDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}

function formatMonthYear(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long', year: 'numeric',
  })
}

function getDayNum(dateStr: string) {
  return new Date(dateStr).getDate()
}

function getWeekday(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' })
}

function isToday(dateStr: string) {
  return dateStr === new Date().toISOString().split('T')[0]
}

function isYesterday(dateStr: string) {
  const y = new Date()
  y.setDate(y.getDate() - 1)
  return dateStr === y.toISOString().split('T')[0]
}

function getRelativeLabel(dateStr: string) {
  if (isToday(dateStr)) return 'Today'
  if (isYesterday(dateStr)) return 'Yesterday'
  return null
}

// Group entries by month
function groupByMonth(entries: JournalEntry[]): { month: string; entries: JournalEntry[] }[] {
  const map = new Map<string, JournalEntry[]>()
  for (const entry of entries) {
    const key = formatMonthYear(entry.entry_date)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(entry)
  }
  return Array.from(map.entries()).map(([month, entries]) => ({ month, entries }))
}

export default function JournalPage() {
  const router = useRouter()
  const [entries, setEntries]   = useState<JournalEntry[]>([])
  const [loading, setLoading]   = useState(true)
  const [todayDone, setTodayDone] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }

      const data = await getAllEntries()
      setEntries(data)

      const today = new Date().toISOString().split('T')[0]
      setTodayDone(data.some(e => e.entry_date === today))
      setLoading(false)
    }
    init()
  }, [router])

  const grouped = groupByMonth(entries)
  const totalEntries = entries.length

  // Longest streak
  function getLongestStreak() {
    if (!entries.length) return 0
    const dates = entries.map(e => e.entry_date).sort()
    let longest = 1, current = 1
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1])
      const curr = new Date(dates[i])
      const diff = (curr.getTime() - prev.getTime()) / 86400000
      if (diff === 1) { current++; longest = Math.max(longest, current) }
      else current = 1
    }
    return longest
  }

  // Current streak
  function getCurrentStreak() {
    if (!entries.length) return 0
    let streak = 0
    const today = new Date()
    for (let i = 0; i < 365; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      const s = d.toISOString().split('T')[0]
      if (entries.some(e => e.entry_date === s)) streak++
      else break
    }
    return streak
  }

  if (loading) {
    return (
      <div className={styles.loadingWrap}>
        <div className={styles.loadingDots}>
          <span /><span /><span />
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');`}</style>

      {/* ── Header ── */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.heading}>Journal</h1>
          <p className={styles.subheading}>Your daily reflections</p>
        </div>
        {/* Today status pill */}
        <div className={`${styles.todayPill} ${todayDone ? styles.todayPillDone : styles.todayPillPending}`}>
          {todayDone ? '✓ Logged today' : '○ Not logged today'}
        </div>
      </div>

      {/* ── Stats strip ── */}
      <div className={styles.statsStrip}>
        {[
          { icon: '📝', value: totalEntries,        label: 'Total entries'   },
          { icon: '🔥', value: getCurrentStreak(),  label: 'Current streak'  },
          { icon: '🏆', value: getLongestStreak(),  label: 'Longest streak'  },
          { icon: '📅', value: totalEntries > 0
              ? new Date(entries[entries.length - 1].entry_date)
                  .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              : '—',
            label: 'First entry' },
        ].map(s => (
          <div key={s.label} className={styles.statCard}>
            <span className={styles.statIcon}>{s.icon}</span>
            <div>
              <div className={styles.statValue}>{s.value}</div>
              <div className={styles.statLabel}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Empty state ── */}
      {entries.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📝</div>
          <div className={styles.emptyTitle}>No entries yet</div>
          <div className={styles.emptySub}>
            Hit the journal button in the bottom-right corner to log your first entry.
          </div>
        </div>
      ) : (
        <div className={styles.timeline}>
          {grouped.map(({ month, entries: monthEntries }) => (
            <div key={month} className={styles.monthGroup}>

              {/* Month label */}
              <div className={styles.monthLabel}>{month}</div>

              {monthEntries.map((entry, idx) => {
                const relLabel = getRelativeLabel(entry.entry_date)
                const isLast   = idx === monthEntries.length - 1

                return (
                  <div key={entry.id} className={styles.timelineRow}>

                    {/* ── Left: date marker ── */}
                    <div className={styles.dateSide}>
                      <div className={styles.dayNum}>{getDayNum(entry.entry_date)}</div>
                      <div className={styles.weekday}>{getWeekday(entry.entry_date)}</div>
                    </div>

                    {/* ── Centre: line + dot ── */}
                    <div className={styles.lineCol}>
                      <div className={`${styles.dot} ${isToday(entry.entry_date) ? styles.dotToday : ''}`} />
                      {!isLast && <div className={styles.line} />}
                    </div>

                    {/* ── Right: entry card ── */}
                    <div className={`${styles.entryCard} ${isToday(entry.entry_date) ? styles.entryCardToday : ''}`}>
                      {relLabel && (
                        <span className={`${styles.relLabel} ${isToday(entry.entry_date) ? styles.relLabelToday : ''}`}>
                          {relLabel}
                        </span>
                      )}
                      <div className={styles.entryDate}>{formatFullDate(entry.entry_date)}</div>
                      <p className={styles.entryContent}>{entry.content}</p>
                      <div className={styles.entryMeta}>
                        {new Date(entry.created_at).toLocaleTimeString('en-US', {
                          hour: 'numeric', minute: '2-digit', hour12: true,
                        })}
                      </div>
                    </div>

                  </div>
                )
              })}
            </div>
          ))}

          {/* Timeline end cap */}
          <div className={styles.timelineEnd}>
            <div className={styles.endDot} />
            <span className={styles.endLabel}>The beginning</span>
          </div>
        </div>
      )}
    </div>
  )
}