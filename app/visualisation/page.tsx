'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, BarChart, Bar, Cell
} from 'recharts'
import styles from './Visualisation.module.css'

// ── Types ──────────────────────────────────────────────────────────────────
type Habit = {
  id: string
  name: string
  color: string
  icon: string
  frequency: string
}

type Completion = {
  habit_id: string
  completed_date: string
}

type DailyWin = {
  win_date: string
  completed: boolean
}

type Tab = 'overview' | 'habits' | 'wins'
type Period = '7d' | '30d' | '90d'

// ── Helpers ────────────────────────────────────────────────────────────────
function getPastDates(days: number): string[] {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (days - 1 - i))
    return d.toISOString().split('T')[0]
  })
}

function getWeeksBack(weeks: number): string[][] {
  const days = getPastDates(weeks * 7)
  const weeks2d: string[][] = []
  for (let i = 0; i < days.length; i += 7) {
    weeks2d.push(days.slice(i, i + 7))
  }
  return weeks2d
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function computeCurrentStreak(completions: string[]): number {
  const today = new Date()
  let streak = 0
  for (let i = 0; i < 365; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const s = d.toISOString().split('T')[0]
    if (completions.includes(s)) streak++
    else break
  }
  return streak
}

function getHeatColor(count: number, max: number, baseColor: string): string {
  if (count === 0) return '#f0ede8'
  const intensity = Math.min(count / Math.max(max, 1), 1)
  // Parse hex → apply opacity
  const r = parseInt(baseColor.slice(1, 3), 16)
  const g = parseInt(baseColor.slice(3, 5), 16)
  const b = parseInt(baseColor.slice(5, 7), 16)
  const a = 0.15 + intensity * 0.85
  return `rgba(${r},${g},${b},${a})`
}

const DAY_ABBRS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

// ── Custom tooltip ─────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#1a1a18', color: '#fff', borderRadius: 8,
      padding: '8px 12px', fontSize: 13, fontFamily: 'DM Sans, sans-serif',
    }}>
      <div style={{ fontWeight: 600 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color ?? '#fff', marginTop: 2 }}>
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────
export default function VisualisationPage() {
  const router = useRouter()

  const [habits, setHabits]           = useState<Habit[]>([])
  const [completions, setCompletions] = useState<Completion[]>([])
  const [wins, setWins]               = useState<DailyWin[]>([])
  const [loading, setLoading]         = useState(true)
  const [activeTab, setActiveTab]     = useState<Tab>('overview')
  const [period, setPeriod]           = useState<Period>('30d')
  const [selectedHabit, setSelectedHabit] = useState<string | null>(null)

  // ── Load data ─────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }

    const [{ data: hData }, { data: cData }, { data: wData }] = await Promise.all([
      supabase.from('habits').select('id, name, color, icon, frequency').eq('user_id', user.id),
      supabase.from('habit_completions').select('habit_id, completed_date').eq('user_id', user.id),
      supabase.from('daily_wins').select('win_date, completed').eq('user_id', user.id),
    ])

    if (hData) { setHabits(hData); if (hData.length) setSelectedHabit(hData[0].id) }
    if (cData) setCompletions(cData)
    if (wData) setWins(wData)
    setLoading(false)
  }, [router])

  useEffect(() => { load() }, [load])

  // ── Derived values ────────────────────────────────────────────────────
  const periodDays = period === '7d' ? 7 : period === '30d' ? 30 : 90
  const dates      = getPastDates(periodDays)
  const today      = new Date().toISOString().split('T')[0]

  // Overall stats
  const totalCompletions = completions.filter(c => dates.includes(c.completed_date)).length
  const uniqueDaysActive = new Set(completions.filter(c => dates.includes(c.completed_date)).map(c => c.completed_date)).size
  const bestStreak       = habits.length
    ? Math.max(...habits.map(h =>
        computeCurrentStreak(completions.filter(c => c.habit_id === h.id).map(c => c.completed_date))
      ))
    : 0
  const totalWins     = wins.filter(w => dates.includes(w.win_date))
  const completedWins = totalWins.filter(w => w.completed).length

  // Daily wins chart data
  const winsChartData = dates.map(date => {
    const dayWins = wins.filter(w => w.win_date === date)
    return {
      date: formatDate(date),
      total: dayWins.length,
      completed: dayWins.filter(w => w.completed).length,
    }
  }).filter(d => d.total > 0)

  // Habit completion rate in period
  const habitRates = habits.map(h => {
    const hComps = completions.filter(c => c.habit_id === h.id && dates.includes(c.completed_date))
    const denominator = h.frequency === 'daily' ? periodDays
      : h.frequency === 'weekly' ? Math.round(periodDays / 7)
      : Math.round(periodDays / 30)
    const pct = Math.min(Math.round((hComps.length / Math.max(denominator, 1)) * 100), 100)
    return { ...h, completions: hComps.length, denominator, pct }
  }).sort((a, b) => b.pct - a.pct)

  // Selected habit heatmap — weeks based on period
  const heatmapWeekCount = period === '7d' ? 1 : period === '30d' ? 4 : 13
  const barWeekCount     = period === '7d' ? 1 : period === '30d' ? 4 : 13

  const selectedHabitData = habits.find(h => h.id === selectedHabit)
  const selectedCompletions = completions
    .filter(c => c.habit_id === selectedHabit)
    .map(c => c.completed_date)
  const heatmapWeeks = getWeeksBack(heatmapWeekCount)

  // Weekly bar chart for selected habit
  const weeklyBarData = getWeeksBack(barWeekCount).map((week) => {
    const done = week.filter(d => selectedCompletions.includes(d)).length
    const label = formatDate(week[0])
    return { week: label, completed: done }
  })

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#faf8f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 32, opacity: 0.3 }}>📊</div>
      </div>
    )
  }

  return (
    <div className={styles.page}>

      {/* ── Header ── */}
      <div className={styles.pageHeader}>
        <h1 className={styles.heading}>Visualisation</h1>
        <p className={styles.subheading}>Your progress at a glance</p>
      </div>

      {/* ── Tab bar ── */}
      <div className={styles.tabBar}>
        {([
          { key: 'overview', label: '⊞ Overview' },
          { key: 'habits',   label: '🔁 Habits' },
          { key: 'wins',     label: '🏆 Daily Wins' },
        ] as { key: Tab; label: string }[]).map(t => (
          <button
            key={t.key}
            className={`${styles.tab} ${activeTab === t.key ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Stats Strip ── */}
      <div className={styles.statsStrip}>
        {[
          { icon: '✅', value: totalCompletions,    label: `Habit completions (${period})` },
          { icon: '📅', value: uniqueDaysActive,    label: 'Active days' },
          { icon: '🔥', value: bestStreak,          label: 'Best current streak' },
          { icon: '🏆', value: `${completedWins}/${totalWins.length}`, label: 'Wins completed' },
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

      {/* ── Period selector ── */}
      <div className={styles.content}>
        <div className={styles.periodSelector}>
          {(['7d', '30d', '90d'] as Period[]).map(p => (
            <button
              key={p}
              className={`${styles.periodBtn} ${period === p ? styles.periodBtnActive : ''}`}
              onClick={() => setPeriod(p)}
            >
              {p === '7d' ? 'Last 7 days' : p === '30d' ? 'Last 30 days' : 'Last 90 days'}
            </button>
          ))}
        </div>

        {/* ══ OVERVIEW TAB ══ */}
        {activeTab === 'overview' && (
          <>
            {/* Habit completion rates */}
            <div className={styles.sectionCard}>
              <div className={styles.sectionTitle}>Habit Completion Rates</div>
              <div className={styles.sectionSub}>How consistently you're hitting each habit</div>
              {habitRates.length === 0 ? (
                <div className={styles.emptyState}>No habits yet — add some on the Habits page!</div>
              ) : (
                <div className={styles.progressList}>
                  {habitRates.map(h => (
                    <div key={h.id} className={styles.progressItem}>
                      <div className={styles.progressTop}>
                        <div className={styles.progressName}>
                          <span>{h.icon}</span>
                          <span>{h.name}</span>
                        </div>
                        <span className={styles.progressPct}>{h.pct}%</span>
                      </div>
                      <div className={styles.progressBg}>
                        <div
                          className={styles.progressFill}
                          style={{ width: `${h.pct}%`, background: h.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Daily wins line chart */}
            <div className={styles.sectionCard}>
              <div className={styles.sectionTitle}>Daily Wins Over Time</div>
              <div className={styles.sectionSub}>Total planned vs completed wins per day</div>
              {winsChartData.length === 0 ? (
                <div className={styles.emptyState}>No wins data for this period yet.</div>
              ) : (
                <div className={styles.lineChartWrap}>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={winsChartData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#bbb' }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#bbb' }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="total" stroke="#e8e4de" strokeWidth={2} dot={false} name="Planned" />
                      <Line type="monotone" dataKey="completed" stroke="#e8736c" strokeWidth={2.5} dot={{ fill: '#e8736c', r: 3 }} name="Completed" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </>
        )}

        {/* ══ HABITS TAB ══ */}
        {activeTab === 'habits' && (
          <>
            {habits.length === 0 ? (
              <div className={styles.sectionCard}>
                <div className={styles.emptyState}>No habits yet — go add some on the Habits page!</div>
              </div>
            ) : (
              <>
                {/* Habit selector */}
                <div className={styles.habitSelector}>
                  {habits.map(h => (
                    <button
                      key={h.id}
                      className={`${styles.habitChip} ${selectedHabit === h.id ? styles.habitChipActive : ''}`}
                      style={selectedHabit === h.id ? { background: h.color } : {}}
                      onClick={() => setSelectedHabit(h.id)}
                    >
                      <span>{h.icon}</span>
                      <span>{h.name}</span>
                    </button>
                  ))}
                </div>

                {/* 16-week Heatmap */}
                {selectedHabitData && (
                  <div className={styles.sectionCard}>
                    <div className={styles.sectionTitle}>
                      {selectedHabitData.icon} {selectedHabitData.name} — Completion Heatmap
                    </div>
                    <div className={styles.sectionSub}>
                      {period === '7d' ? 'Last 7 days' : period === '30d' ? 'Last 4 weeks' : 'Last 13 weeks'}
                    </div>

                    <div className={styles.heatmapWrap}>
                      <div className={styles.heatmapRow}>
                        {/* Day labels */}
                        <div className={styles.heatmapDayLabels}>
                          {DAY_ABBRS.map((d, i) => (
                            <div key={i} className={styles.heatmapDayLabel}>{i % 2 === 1 ? d : ''}</div>
                          ))}
                        </div>
                        {/* Week columns */}
                        <div className={styles.heatmapGrid}>
                          {heatmapWeeks.map((week, wi) => (
                            <div key={wi} className={styles.heatmapWeekCol}>
                              {week.map((day, di) => {
                                const done = selectedCompletions.includes(day)
                                const isT  = day === today
                                return (
                                  <div
                                    key={day}
                                    className={styles.heatCell}
                                    style={{
                                      background: done ? selectedHabitData.color : '#f0ede8',
                                      opacity: done ? 1 : isT ? 0.5 : 0.4,
                                      outline: isT ? `2px solid ${selectedHabitData.color}` : 'none',
                                      outlineOffset: 1,
                                    }}
                                    title={`${day}: ${done ? '✓ Done' : 'Not done'}`}
                                  />
                                )
                              })}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Legend */}
                      <div className={styles.heatLegend}>
                        <span className={styles.heatLegendLabel}>Less</span>
                        {[0.15, 0.4, 0.6, 0.8, 1].map(op => (
                          <div
                            key={op}
                            className={styles.heatLegendCell}
                            style={{ background: selectedHabitData.color, opacity: op }}
                          />
                        ))}
                        <span className={styles.heatLegendLabel}>More</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Weekly bar chart */}
                <div className={styles.sectionCard}>
                  <div className={styles.sectionTitle}>Weekly Completions</div>
                  <div className={styles.sectionSub}>How many days per week you completed this habit</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={weeklyBarData} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" />
                      <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#bbb' }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#bbb' }} tickLine={false} axisLine={false} domain={[0, 7]} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="completed" name="Days completed" radius={[4, 4, 0, 0]}>
                        {weeklyBarData.map((_, i) => (
                          <Cell key={i} fill={selectedHabitData?.color ?? '#4a9e6b'} fillOpacity={0.85} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Streak comparison bar chart */}
                <div className={styles.sectionCard}>
                  <div className={styles.sectionTitle}>Current Streaks — All Habits</div>
                  <div className={styles.sectionSub}>Current consecutive day streak per habit</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={habits.map(h => ({
                        name: `${h.icon} ${h.name}`,
                        streak: computeCurrentStreak(
                          completions.filter(c => c.habit_id === h.id).map(c => c.completed_date)
                        ),
                        color: h.color,
                      }))}
                      margin={{ top: 5, right: 10, bottom: 30, left: -20 }}
                      layout="vertical"
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: '#bbb' }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#555' }} tickLine={false} axisLine={false} width={140} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="streak" name="Streak (days)" radius={[0, 4, 4, 0]}>
                        {habits.map((h, i) => (
                          <Cell key={i} fill={h.color} fillOpacity={0.85} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </>
        )}

        {/* ══ WINS TAB ══ */}
        {activeTab === 'wins' && (
          <>
            {/* Line chart */}
            <div className={styles.sectionCard}>
              <div className={styles.sectionTitle}>Daily Wins — Completion Over Time</div>
              <div className={styles.sectionSub}>Planned vs completed wins per day</div>
              {winsChartData.length === 0 ? (
                <div className={styles.emptyState}>No wins data for this period.</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={winsChartData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#bbb' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#bbb' }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="total"     stroke="#e8e4de" strokeWidth={2}   dot={false} name="Planned" />
                    <Line type="monotone" dataKey="completed" stroke="#e8736c" strokeWidth={2.5} dot={{ fill: '#e8736c', r: 3 }} name="Completed" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Daily completion rate bar chart */}
            <div className={styles.sectionCard}>
              <div className={styles.sectionTitle}>Daily Completion Rate</div>
              <div className={styles.sectionSub}>% of wins completed each day</div>
              {winsChartData.length === 0 ? (
                <div className={styles.emptyState}>No data yet.</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={winsChartData.map(d => ({
                      ...d,
                      rate: d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0,
                    }))}
                    margin={{ top: 5, right: 10, bottom: 5, left: -20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#bbb' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#bbb' }} tickLine={false} axisLine={false} domain={[0, 100]} unit="%" />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="rate" name="Completion %" radius={[4, 4, 0, 0]}>
                      {winsChartData.map((d, i) => {
                        const rate = d.total > 0 ? (d.completed / d.total) : 0
                        const color = rate === 1 ? '#4a9e6b' : rate >= 0.6 ? '#d4a017' : '#e8736c'
                        return <Cell key={i} fill={color} fillOpacity={0.85} />
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  )
}