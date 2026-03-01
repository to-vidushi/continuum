'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

const NAV_ITEMS = [
  { icon: '⊞', label: 'Dashboard',     path: '/',               active: true  },
  { icon: '🏆', label: 'Daily Wins',   path: '/daily-wins',     active: false },
  { icon: '🔁', label: 'Habits',       path: '/habits',         active: false },
  { icon: '📊', label: 'Visualisation',path: '/visualisation',  active: false },
  { icon: '⬜', label: 'Kanban',       path: '/kanban',         active: false },
  { icon: '📝', label: 'Weekly Review',path: '/weekly-review',  active: false },
  { icon: '⚡', label: 'Challenges',   path: '/challenges',     active: false },
]

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
  const [loading, setLoading]         = useState(true)
  const [userName, setUserName]       = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [todayWins, setTodayWins]     = useState({ total: 0, completed: 0 })
  const [habitStreak, setHabitStreak] = useState(0)
  const [activeBoards, setActiveBoards] = useState(0)

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth'); return }

      const email = session.user.email ?? ''
      setUserName(email.split('@')[0])

      // Fetch today's wins
      const { data: wins } = await supabase
        .from('daily_wins')
        .select('completed')
        .eq('win_date', today)

      if (wins) {
        setTodayWins({
          total: wins.length,
          completed: wins.filter(w => w.completed).length,
        })
      }

      // Fetch habit streak
      const { data: completions } = await supabase
        .from('habit_completions')
        .select('completed_date')
        .eq('user_id', session.user.id)
        .order('completed_date', { ascending: false })

      if (completions) {
        let streak = 0
        const now = new Date()
        for (let i = 0; i < 365; i++) {
          const d = new Date(now)
          d.setDate(now.getDate() - i)
          const dateStr = d.toISOString().split('T')[0]
          if (completions.some(c => c.completed_date === dateStr)) {
            streak++
          } else {
            break
          }
        }
        setHabitStreak(streak)
      }

      // Fetch kanban projects count for active boards stat
      const { count: boardCount } = await supabase
        .from('kanban_projects')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
      if (typeof boardCount === 'number') {
        setActiveBoards(boardCount)
      }

      setLoading(false)
    }
    init()
  }, [router])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  const getStatValue = (label: string) => {
    if (label === 'Daily Wins')       return `${todayWins.completed}/${todayWins.total}`
    if (label === 'Habit Tracking')   return habitStreak ? `${habitStreak} days` : '—'
    if (label === 'Kanban Boards')    return activeBoards > 0 ? `${activeBoards}` : '—'
    return '—'
  }

  if (loading) {
    return (
      <div style={styles.loadingScreen}>
        <div style={styles.loadingDot} />
        <div style={{ ...styles.loadingDot, animationDelay: '0.2s' }} />
        <div style={{ ...styles.loadingDot, animationDelay: '0.4s' }} />
        <style>{`
          @keyframes bounce {
            0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
            40% { transform: translateY(-10px); opacity: 1; }
          }
        `}</style>
      </div>
    )
  }

  return (
    <div style={styles.root}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .feature-card { transition: transform 0.18s ease, box-shadow 0.18s ease; }
        .feature-card:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(0,0,0,0.09) !important; }
        .nav-item { transition: background 0.15s, color 0.15s; }
        .nav-item:hover { background: rgba(255,255,255,0.07) !important; }
        .sign-out-btn:hover { background: rgba(255,255,255,0.1) !important; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fadeUp 0.5s ease both; }
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-10px); opacity: 1; }
        }
      `}</style>

      {/* Sidebar */}
      <aside style={{ ...styles.sidebar, width: sidebarOpen ? 220 : 64 }}>
        <div style={styles.logoRow}>
          <div style={styles.logoMark}>C</div>
          {sidebarOpen && <span style={styles.logoText}>Continuum</span>}
        </div>

        <nav style={styles.nav}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.path}
              className="nav-item"
              onClick={() => router.push(item.path)}
              title={!sidebarOpen ? item.label : undefined}
              style={{
                ...styles.navItem,
                background: item.active ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: item.active ? '#fff' : 'rgba(255,255,255,0.55)',
                justifyContent: sidebarOpen ? 'flex-start' : 'center',
              }}
            >
              <span style={styles.navIcon}>{item.icon}</span>
              {sidebarOpen && <span style={styles.navLabel}>{item.label}</span>}
            </button>
          ))}
        </nav>

        <div style={styles.sidebarBottom}>
          {sidebarOpen && (
            <div style={styles.userChip}>
              <div style={styles.avatar}>{userName[0]?.toUpperCase()}</div>
              <span style={styles.userEmail}>{userName}</span>
            </div>
          )}
          <button
            className="sign-out-btn"
            onClick={handleSignOut}
            style={{ ...styles.signOutBtn, justifyContent: sidebarOpen ? 'flex-start' : 'center' }}
          >
            <span>↪</span>
            {sidebarOpen && <span>Sign out</span>}
          </button>
        </div>

        <button
          onClick={() => setSidebarOpen(p => !p)}
          style={styles.collapseBtn}
          title={sidebarOpen ? 'Collapse' : 'Expand'}
        >
          {sidebarOpen ? '‹' : '›'}
        </button>
      </aside>

      {/* Main */}
      <main style={styles.main}>
        <div style={styles.topBar}>
          <span style={styles.todayLabel}>{getTodayFormatted()}</span>
        </div>

        {/* Hero */}
        <div className="fade-up" style={styles.hero}>
          <div style={styles.greetingLabel}>{getGreeting()},</div>
          <h1 style={styles.heroName}>{userName} 👋</h1>
          <p style={styles.heroBye}>What will you win today?</p>
        </div>

        {/* Stats strip */}
        <div className="fade-up" style={{ ...styles.statsStrip, animationDelay: '0.1s' }}>
          {[
            { label: "Today's Wins",    value: `${todayWins.completed} / ${todayWins.total}`, icon: '🏆' },
            { label: 'Habit Streak',    value: habitStreak ? `🔥 ${habitStreak} days` : '—',  icon: '🔥' },
            { label: 'Active Challenge',value: '—',                                            icon: '⚡' },
            { label: 'Week Score',      value: '—',                                            icon: '📊' },
          ].map(stat => (
            <div key={stat.label} style={styles.statCard}>
              <span style={styles.statIcon}>{stat.icon}</span>
              <div>
                <div style={styles.statValue}>{stat.value}</div>
                <div style={styles.statLabel}>{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Section header */}
        <div className="fade-up" style={{ ...styles.sectionHeader, animationDelay: '0.2s' }}>
          <h2 style={styles.sectionTitle}>Your Space</h2>
          <span style={styles.sectionSub}>Pick where to focus</span>
        </div>

        {/* Feature grid */}
        <div style={styles.grid}>
          {FEATURES.map((f, i) => (
            <button
              key={f.label}
              className="feature-card fade-up"
              onClick={() => router.push(f.path)}
              style={{
                ...styles.featureCard,
                background: f.bg,
                border: `1px solid ${f.border}`,
                animationDelay: `${0.15 + i * 0.07}s`,
              }}
            >
              <div style={styles.featureTop}>
                <span style={styles.featureIcon}>{f.icon}</span>
                <span style={{ ...styles.featureStat, color: f.color }}>
                  {getStatValue(f.label)}{' '}
                  <span style={styles.featureStatLabel}>{f.stat}</span>
                </span>
              </div>
              <div style={{ ...styles.featureLabel, color: f.color }}>{f.label}</div>
              <div style={styles.featureDesc}>{f.description}</div>
              <div style={{ ...styles.featureArrow, color: f.color }}>→</div>
            </button>
          ))}
        </div>
      </main>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    minHeight: '100vh',
    background: '#f5f3ef',
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },
  loadingScreen: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    background: '#1a1a18',
  },
  loadingDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: '#fff',
    animation: 'bounce 1.2s infinite ease-in-out',
  },
  sidebar: {
    background: '#1a1a18',
    display: 'flex',
    flexDirection: 'column',
    position: 'sticky',
    top: 0,
    height: '100vh',
    flexShrink: 0,
    transition: 'width 0.25s ease',
    overflow: 'hidden',
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '28px 20px 24px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  logoMark: {
    width: 32,
    height: 32,
    background: '#e8736c',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontFamily: "'DM Serif Display', serif",
    fontSize: '18px',
    flexShrink: 0,
  },
  logoText: {
    fontFamily: "'DM Serif Display', serif",
    fontSize: '18px',
    color: '#fff',
    whiteSpace: 'nowrap',
  },
  nav: {
    flex: 1,
    padding: '16px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
    fontFamily: "'DM Sans', system-ui, sans-serif",
    width: '100%',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  },
  navIcon:  { fontSize: '16px', flexShrink: 0, width: 20, textAlign: 'center' },
  navLabel: { fontSize: '14px' },
  sidebarBottom: {
    padding: '12px 10px 16px',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  userChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: '#e8736c',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: 600,
    flexShrink: 0,
  },
  userEmail: {
    fontSize: '13px',
    color: 'rgba(255,255,255,0.5)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  signOutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    background: 'transparent',
    border: 'none',
    borderRadius: '8px',
    color: 'rgba(255,255,255,0.4)',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: "'DM Sans', system-ui, sans-serif",
    width: '100%',
  },
  collapseBtn: {
    position: 'absolute',
    top: '50%',
    right: -12,
    transform: 'translateY(-50%)',
    width: 24,
    height: 24,
    background: '#1a1a18',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '50%',
    color: 'rgba(255,255,255,0.5)',
    fontSize: '14px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  main: {
    flex: 1,
    padding: '0 48px 60px',
    overflowY: 'auto',
    minWidth: 0,
  },
  topBar: {
    padding: '24px 0 0',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  todayLabel: { fontSize: '13px', color: '#aaa' },
  hero:         { paddingTop: 32, paddingBottom: 36 },
  greetingLabel:{ fontSize: '15px', color: '#999', marginBottom: 4 },
  heroName: {
    fontFamily: "'DM Serif Display', serif",
    fontSize: '42px',
    fontWeight: 400,
    color: '#1a1a18',
    lineHeight: 1.1,
    marginBottom: 8,
  },
  heroBye: { fontSize: '16px', color: '#888' },
  statsStrip: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 12,
    marginBottom: 40,
  },
  statCard: {
    background: '#fff',
    borderRadius: '12px',
    padding: '16px 18px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    border: '1px solid #ece9e2',
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
  },
  statIcon:  { fontSize: '22px' },
  statValue: { fontSize: '20px', fontWeight: 700, color: '#1a1a18', lineHeight: 1 },
  statLabel: { fontSize: '12px', color: '#aaa', marginTop: 2 },
  sectionHeader: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 12,
    marginBottom: 18,
  },
  sectionTitle: {
    fontFamily: "'DM Serif Display', serif",
    fontSize: '22px',
    fontWeight: 400,
    color: '#1a1a18',
  },
  sectionSub: { fontSize: '13px', color: '#bbb' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 16,
  },
  featureCard: {
    borderRadius: '14px',
    padding: '22px 22px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    cursor: 'pointer',
    textAlign: 'left',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  },
  featureTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  featureIcon:      { fontSize: '26px' },
  featureStat:      { fontSize: '15px', fontWeight: 700 },
  featureStatLabel: { fontSize: '11px', fontWeight: 400, opacity: 0.7 },
  featureLabel:     { fontSize: '17px', fontWeight: 700, letterSpacing: '-0.2px' },
  featureDesc:      { fontSize: '13px', color: '#777', lineHeight: 1.5, flex: 1 },
  featureArrow:     { fontSize: '18px', marginTop: 8, fontWeight: 300 },
}