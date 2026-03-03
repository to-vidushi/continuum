'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import Sidebar from '@/components/Sidebar'

const FEATURES = [
  {
    icon: '🏆',
    label: 'Daily Wins',
    description: 'Plan your wins each morning. Check them off at night. See your score.',
    path: '/daily-wins',
    color: '#e8736c',
    bg: '#fff5f4',
    border: '#fcd5d2',
    stat: 'Today',
  },
  {
    icon: '🔁',
    label: 'Habit Tracking',
    description: 'Build streaks across weekly, monthly and yearly timescales.',
    path: '/habits',
    color: '#4a9e6b',
    bg: '#f2fbf5',
    border: '#c3e6cc',
    stat: 'Current streak',
  },
  {
    icon: '📊',
    label: 'Visualisation',
    description: 'Charts and heatmaps showing your progress over time.',
    path: '/visualisation',
    color: '#5b7fe8',
    bg: '#f2f5ff',
    border: '#c8d4f8',
    stat: 'This week',
  },
  {
    icon: '⬜',
    label: 'Kanban Boards',
    description: 'Visual workflow boards to move tasks from idea to done.',
    path: '/kanban',
    color: '#9b6ed4',
    bg: '#f8f2ff',
    border: '#dcc8f8',
    stat: 'Active boards',
  },
  {
    icon: '📝',
    label: 'Journal',
    description: 'A daily note — what actually happened. Feeds your weekly AI review.',
    path: '/journal',
    color: '#3a7bd5',
    bg: '#f0f5ff',
    border: '#c5d8f8',
    stat: 'Entries',
  },
  {
    icon: '🗓️',
    label: 'Weekly Review',
    description: 'Auto-generated review of your week based on your lists and habits.',
    path: '/weekly-review',
    color: '#d4a017',
    bg: '#fffbf0',
    border: '#f0dfa0',
    stat: 'Last review',
  },
  {
    icon: '⚡',
    label: 'Challenges',
    description: 'Anonymous group challenges. Do it together with strangers worldwide.',
    path: '/challenges',
    color: '#e08c3a',
    bg: '#fff8f0',
    border: '#f8d9b0',
    stat: 'Active now',
  },
]

type Badge = {
  id: string
  title: string
  icon: string
  category: string
  duration_days: number
  earned_at: string
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function getTodayFormatted() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}

export default function Home() {
  const router = useRouter()

  const [loading, setLoading]               = useState(true)
  const [userName, setUserName]             = useState('')
  const [todayWins, setTodayWins]           = useState({ total: 0, completed: 0 })
  const [badges, setBadges]                 = useState<Badge[]>([])
  const [badgesExpanded, setBadgesExpanded] = useState(false)
  const [habitStreak, setHabitStreak]       = useState(0)
  const [activeBoards, setActiveBoards]     = useState(0)
  const [journalCount, setJournalCount]     = useState(0)

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth'); return }

      const uid   = session.user.id
      const email = session.user.email ?? ''
      setUserName(email.split('@')[0])

      const [
        { data: wins },
        { data: completions },
        { count: boardCount },
        { count: journalTotal },
      ] = await Promise.all([
        supabase.from('daily_wins').select('completed').eq('win_date', today),
        supabase.from('habit_completions').select('completed_date').eq('user_id', uid).order('completed_date', { ascending: false }),
        supabase.from('kanban_projects').select('id', { count: 'exact', head: true }).eq('user_id', uid),
        supabase.from('journal_entries').select('id', { count: 'exact', head: true }),
      ])

      if (wins) setTodayWins({ total: wins.length, completed: wins.filter(w => w.completed).length })
      if (typeof boardCount === 'number') setActiveBoards(boardCount)
      if (typeof journalTotal === 'number') setJournalCount(journalTotal)

      if (completions) {
        let streak = 0
        const now = new Date()
        for (let i = 0; i < 365; i++) {
          const d = new Date(now)
          d.setDate(now.getDate() - i)
          const dateStr = d.toISOString().split('T')[0]
          if (completions.some(c => c.completed_date === dateStr)) streak++
          else break
        }
        setHabitStreak(streak)
      }

      await loadBadges(uid)
      setLoading(false)
    }
    init()
  }, [router, today])

  const loadBadges = async (uid: string) => {
    const { data: participants } = await supabase
      .from('challenge_participants').select('challenge_id').eq('user_id', uid)
    if (!participants?.length) return

    const ids = participants.map(p => p.challenge_id)
    const [{ data: challenges }, { data: checkins }] = await Promise.all([
      supabase.from('challenges').select('id, title, icon, category, duration_days').in('id', ids),
      supabase.from('challenge_checkins').select('challenge_id, checkin_date').eq('user_id', uid).in('challenge_id', ids),
    ])
    if (!challenges || !checkins) return

    const earned: Badge[] = []
    for (const c of challenges) {
      const userCheckins = checkins.filter(ck => ck.challenge_id === c.id)
      if (userCheckins.length >= c.duration_days) {
        const last = userCheckins.sort((a, b) => b.checkin_date.localeCompare(a.checkin_date))[0]
        earned.push({ id: c.id, title: c.title, icon: c.icon, category: c.category, duration_days: c.duration_days, earned_at: last?.checkin_date ?? '' })
      }
    }
    setBadges(earned)
  }

  const getStatValue = (label: string) => {
    if (label === 'Daily Wins')     return `${todayWins.completed}/${todayWins.total}`
    if (label === 'Habit Tracking') return habitStreak ? `${habitStreak} days` : '—'
    if (label === 'Kanban Boards')  return activeBoards > 0 ? `${activeBoards}` : '—'
    if (label === 'Journal')        return journalCount > 0 ? `${journalCount}` : '—'
    return '—'
  }

  const displayedBadges = badgesExpanded ? badges : badges.slice(0, 6)

  if (loading) {
    return (
      <div style={s.loadingScreen}>
        <div style={s.loadingDot} />
        <div style={{ ...s.loadingDot, animationDelay: '0.2s' }} />
        <div style={{ ...s.loadingDot, animationDelay: '0.4s' }} />
        <style>{`@keyframes bounce{0%,80%,100%{transform:translateY(0);opacity:.4}40%{transform:translateY(-10px);opacity:1}}`}</style>
      </div>
    )
  }

  return (
    <div style={s.root}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .feature-card{transition:transform .18s ease,box-shadow .18s ease}
        .feature-card:hover{transform:translateY(-3px);box-shadow:0 12px 32px rgba(0,0,0,.09)!important}
        .badge-card{transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}
        .badge-card:hover{transform:translateY(-3px);box-shadow:0 8px 24px rgba(0,0,0,.08)!important;border-color:#1a1a18!important}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        .fade-up{animation:fadeUp .5s ease both}
        @keyframes popIn{from{transform:scale(.85);opacity:0}to{transform:scale(1);opacity:1}}
        @keyframes bounce{0%,80%,100%{transform:translateY(0);opacity:.4}40%{transform:translateY(-10px);opacity:1}}
        @keyframes shimmerMove{from{transform:translateX(-100%)}to{transform:translateX(100%)}}
        .badge-icon-inner:hover .badge-shimmer{animation:shimmerMove .5s ease}
      `}</style>

      <Sidebar />

      <main style={s.main}>
        <div style={s.topBar}>
          <span style={s.todayLabel}>{getTodayFormatted()}</span>
        </div>

        {/* Hero */}
        <div className="fade-up" style={s.hero}>
          <div style={s.greetingLabel}>{getGreeting()},</div>
          <h1 style={s.heroName}>{userName} 👋</h1>
          <p style={s.heroBye}>What will you win today?</p>
        </div>

        {/* Stats strip */}
        <div className="fade-up" style={{ ...s.statsStrip, animationDelay: '0.1s' }}>
          {[
            { label: "Today's Wins",    value: `${todayWins.completed} / ${todayWins.total}`, icon: '🏆' },
            { label: 'Habit Streak',    value: habitStreak ? `🔥 ${habitStreak} days` : '—',  icon: '🔥' },
            { label: 'Active Challenge',value: '—',                                            icon: '⚡' },
            { label: 'Week Score',      value: '—',                                            icon: '📊' },
          ].map(stat => (
            <div key={stat.label} style={s.statCard}>
              <span style={s.statIcon}>{stat.icon}</span>
              <div>
                <div style={s.statValue}>{stat.value}</div>
                <div style={s.statLabel}>{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Section header */}
        <div className="fade-up" style={{ ...s.sectionHeader, animationDelay: '0.2s' }}>
          <h2 style={s.sectionTitle}>Your Space</h2>
          <span style={s.sectionSub}>Pick where to focus</span>
        </div>

        {/* Feature grid */}
        <div style={s.grid}>
          {FEATURES.map((f, i) => (
            <button
              key={f.label}
              className="feature-card fade-up"
              onClick={() => router.push(f.path)}
              style={{
                ...s.featureCard,
                background: f.bg,
                border: `1px solid ${f.border}`,
                animationDelay: `${0.15 + i * 0.07}s`,
              }}
            >
              <div style={s.featureTop}>
                <span style={s.featureIcon}>{f.icon}</span>
                <span style={{ ...s.featureStat, color: f.color }}>
                  {getStatValue(f.label)}{' '}
                  <span style={s.featureStatLabel}>{f.stat}</span>
                </span>
              </div>
              <div style={{ ...s.featureLabel, color: f.color }}>{f.label}</div>
              <div style={s.featureDesc}>{f.description}</div>
              <div style={{ ...s.featureArrow, color: f.color }}>→</div>
            </button>
          ))}
        </div>

        {/* Badges */}
        <div className="fade-up" style={{ animationDelay: '0.5s', marginTop: 48 }}>
          <div style={s.sectionHeader}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flex: 1 }}>
              <h2 style={s.sectionTitle}>Badges</h2>
              <span style={s.sectionSub}>Challenges you've fully completed</span>
            </div>
            {badges.length > 0 && <div style={s.badgeCount}>{badges.length} earned</div>}
          </div>

          {badges.length === 0 ? (
            <div style={s.badgeEmpty}>
              <div style={s.badgeEmptyIcon}>🏅</div>
              <div style={s.badgeEmptyTitle}>No badges yet</div>
              <div style={s.badgeEmptySub}>Complete all days of a challenge to earn your first badge.</div>
              <button onClick={() => router.push('/challenges')} style={s.badgeEmptyBtn}>Browse challenges →</button>
            </div>
          ) : (
            <>
              <div style={s.badgeGrid}>
                {displayedBadges.map((badge, i) => (
                  <div
                    key={badge.id}
                    className="badge-card"
                    style={{ ...s.badgeCard, animation: `popIn .35s cubic-bezier(.34,1.56,.64,1) ${i * 0.06}s both` }}
                  >
                    <div className="badge-icon-inner" style={s.badgeIconWrap}>
                      <span style={{ fontSize: 28, position: 'relative', zIndex: 1 }}>{badge.icon}</span>
                      <div className="badge-shimmer" style={s.badgeShimmer} />
                    </div>
                    <div style={s.badgeTitle}>{badge.title}</div>
                    <div style={s.badgeMeta}>{badge.duration_days}d · {badge.category}</div>
                    <div style={s.badgeDate}>{new Date(badge.earned_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                    <div style={s.badgePill}>✓ Completed</div>
                  </div>
                ))}
              </div>
              {badges.length > 6 && (
                <button onClick={() => setBadgesExpanded(e => !e)} style={s.showMoreBtn}>
                  {badgesExpanded ? 'Show less ↑' : `Show all ${badges.length} badges ↓`}
                </button>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  root: { display: 'flex', minHeight: '100vh', background: '#f5f3ef', fontFamily: "'DM Sans', system-ui, sans-serif" },
  loadingScreen: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#1a1a18' },
  loadingDot: { width: 10, height: 10, borderRadius: '50%', background: '#fff', animation: 'bounce 1.2s infinite ease-in-out' },
  main: { flex: 1, padding: '0 48px 60px', overflowY: 'auto', minWidth: 0 },
  topBar: { padding: '24px 0 0', display: 'flex', justifyContent: 'flex-end' },
  todayLabel: { fontSize: '13px', color: '#aaa' },
  hero: { paddingTop: 32, paddingBottom: 36 },
  greetingLabel: { fontSize: '15px', color: '#999', marginBottom: 4 },
  heroName: { fontFamily: "'DM Serif Display', serif", fontSize: '42px', fontWeight: 400, color: '#1a1a18', lineHeight: 1.1, marginBottom: 8 },
  heroBye: { fontSize: '16px', color: '#888' },
  statsStrip: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 40 },
  statCard: { background: '#fff', borderRadius: '12px', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12, border: '1px solid #ece9e2', boxShadow: '0 1px 4px rgba(0,0,0,.04)' },
  statIcon: { fontSize: '22px' },
  statValue: { fontSize: '20px', fontWeight: 700, color: '#1a1a18', lineHeight: 1 },
  statLabel: { fontSize: '12px', color: '#aaa', marginTop: 2 },
  sectionHeader: { display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 18 },
  sectionTitle: { fontFamily: "'DM Serif Display', serif", fontSize: '22px', fontWeight: 400, color: '#1a1a18' },
  sectionSub: { fontSize: '13px', color: '#bbb' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 },
  featureCard: { borderRadius: '14px', padding: '22px 22px 18px', display: 'flex', flexDirection: 'column', gap: 6, cursor: 'pointer', textAlign: 'left', boxShadow: '0 2px 8px rgba(0,0,0,.05)' },
  featureTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  featureIcon: { fontSize: '26px' },
  featureStat: { fontSize: '15px', fontWeight: 700 },
  featureStatLabel: { fontSize: '11px', fontWeight: 400, opacity: 0.7 },
  featureLabel: { fontSize: '17px', fontWeight: 700, letterSpacing: '-0.2px' },
  featureDesc: { fontSize: '13px', color: '#777', lineHeight: 1.5, flex: 1 },
  featureArrow: { fontSize: '18px', marginTop: 8, fontWeight: 300 },
  badgeCount: { fontSize: '12px', fontWeight: 700, color: '#1a1a18', background: '#ede9e2', borderRadius: '20px', padding: '4px 12px', whiteSpace: 'nowrap' },
  badgeGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 },
  badgeCard: { background: '#fdfcfa', borderRadius: '16px', padding: '20px 14px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, border: '1.5px solid #ede9e2', cursor: 'default', boxShadow: '0 1px 4px rgba(0,0,0,.04)' },
  badgeIconWrap: { width: 60, height: 60, background: '#1a1a18', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' },
  badgeShimmer: { position: 'absolute', inset: 0, background: 'linear-gradient(105deg,transparent 30%,rgba(255,255,255,.15) 50%,transparent 70%)', transform: 'translateX(-100%)' },
  badgeTitle: { fontSize: 13, fontWeight: 700, color: '#1a1a18', textAlign: 'center', lineHeight: 1.3 },
  badgeMeta: { fontSize: 10, color: '#aaa', fontFamily: 'monospace', textAlign: 'center' },
  badgeDate: { fontSize: 10, color: '#bbb', fontFamily: 'monospace' },
  badgePill: { fontSize: 10, fontWeight: 700, color: '#2a7a4b', background: '#eaf7ef', borderRadius: '20px', padding: '3px 10px' },
  badgeEmpty: { background: '#fdfcfa', border: '1.5px solid #ede9e2', borderRadius: '16px', padding: '40px 20px', textAlign: 'center' },
  badgeEmptyIcon: { fontSize: 40, marginBottom: 12, opacity: 0.4 },
  badgeEmptyTitle: { fontSize: 16, fontWeight: 700, color: '#1a1a18', marginBottom: 6 },
  badgeEmptySub: { fontSize: 13, color: '#aaa', maxWidth: 260, margin: '0 auto', lineHeight: 1.5 },
  badgeEmptyBtn: { marginTop: 16, padding: '8px 18px', background: '#1a1a18', color: '#fff', border: 'none', borderRadius: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', system-ui, sans-serif" },
  showMoreBtn: { marginTop: 16, width: '100%', padding: '10px', background: 'transparent', border: '1.5px solid #ede9e2', borderRadius: '12px', fontSize: 13, fontWeight: 600, color: '#777', cursor: 'pointer', fontFamily: "'DM Sans', system-ui, sans-serif" },
}