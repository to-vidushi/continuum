'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import styles from './Sidebar.module.css'

const NAV_ITEMS = [
  { icon: '⊞', label: 'Dashboard',      path: '/'               },
  { icon: '🏆', label: 'Daily Wins',    path: '/daily-wins'     },
  { icon: '🔁', label: 'Habits',        path: '/habits'         },
  { icon: '📊', label: 'Visualisation', path: '/visualisation'  },
  { icon: '⬜', label: 'Kanban',        path: '/kanban'         },
  { icon: '📝', label: 'Journal',       path: '/journal'        },
  { icon: '🗓️', label: 'Weekly Review', path: '/weekly-review'  },
  { icon: '⚡', label: 'Challenges',    path: '/challenges'     },
]

const SIDEBAR_KEY = 'continuum_sidebar_open'

export default function Sidebar() {
  const router   = useRouter()
  const pathname = usePathname()

  const [open, setOpen]         = useState(true)
  const [userName, setUserName] = useState('')
  const [hasJournalToday, setHasJournalToday] = useState(false)

  // Restore collapsed state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_KEY)
    if (stored !== null) setOpen(stored === 'true')
  }, [])

  // Persist collapse state
  function toggleOpen() {
    setOpen(prev => {
      localStorage.setItem(SIDEBAR_KEY, String(!prev))
      return !prev
    })
  }

  // Get user info + check if journal logged today
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const email = session.user.email ?? ''
      setUserName(email.split('@')[0])

      const today = new Date().toISOString().split('T')[0]
      const { data } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('entry_date', today)
        .maybeSingle()
      setHasJournalToday(!!data)
    })
  }, [pathname]) // re-check on navigation so dot updates after logging

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  // Active match: exact for dashboard, prefix for others
  function isActive(path: string) {
    if (path === '/') return pathname === '/'
    return pathname.startsWith(path)
  }

  return (
    <aside className={styles.sidebar} style={{ width: open ? 220 : 64 }}>

      {/* Logo */}
      <div className={styles.logoRow}>
        <div className={styles.logoMark}>C</div>
        {open && <span className={styles.logoText}>Continuum</span>}
      </div>

      {/* Nav */}
      <nav className={styles.nav}>
        {NAV_ITEMS.map(item => {
          const active = isActive(item.path)
          const isJournal = item.path === '/journal'
          const showDot = isJournal && !hasJournalToday

          return (
            <button
              key={item.path}
              className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}
              onClick={() => router.push(item.path)}
              title={!open ? item.label : undefined}
              style={{ justifyContent: open ? 'flex-start' : 'center' }}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {open && <span className={styles.navLabel}>{item.label}</span>}
              {/* Dot indicator — journal not yet logged today */}
              {showDot && (
                <span
                  className={styles.dot}
                  title="Not logged today"
                  style={{ marginLeft: open ? 'auto' : undefined }}
                />
              )}
            </button>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className={styles.sidebarBottom}>
        {open && (
          <div className={styles.userChip}>
            <div className={styles.avatar}>{userName[0]?.toUpperCase()}</div>
            <span className={styles.userEmail}>{userName}</span>
          </div>
        )}
        <button
          className={styles.signOutBtn}
          onClick={handleSignOut}
          style={{ justifyContent: open ? 'flex-start' : 'center' }}
        >
          <span>↪</span>
          {open && <span>Sign out</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        className={styles.collapseBtn}
        onClick={toggleOpen}
        title={open ? 'Collapse' : 'Expand'}
      >
        {open ? '‹' : '›'}
      </button>
    </aside>
  )
}