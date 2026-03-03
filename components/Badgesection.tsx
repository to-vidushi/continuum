'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import styles from './BadgesSection.module.css'

type Badge = {
  id: string
  challenge_id: string
  title: string
  icon: string
  category: string
  duration_days: number
  earned_at: string
}

type Props = {
  userId: string
}

export default function BadgesSection({ userId }: Props) {
  const [badges, setBadges] = useState<Badge[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const load = async () => {
      // Get challenges the user fully completed (checkins = duration_days)
      const { data: participants } = await supabase
        .from('challenge_participants')
        .select('challenge_id')
        .eq('user_id', userId)

      if (!participants || participants.length === 0) {
        setLoading(false)
        return
      }

      const challengeIds = participants.map(p => p.challenge_id)

      const { data: challenges } = await supabase
        .from('challenges')
        .select('id, title, icon, category, duration_days')
        .in('id', challengeIds)

      const { data: checkins } = await supabase
        .from('challenge_checkins')
        .select('challenge_id, checkin_date')
        .eq('user_id', userId)
        .in('challenge_id', challengeIds)

      if (!challenges || !checkins) {
        setLoading(false)
        return
      }

      // Only give badge if checkins >= duration_days
      const earned: Badge[] = []
      for (const c of challenges) {
        const count = checkins.filter(ck => ck.challenge_id === c.id).length
        if (count >= c.duration_days) {
          const lastCheckin = checkins
            .filter(ck => ck.challenge_id === c.id)
            .sort((a, b) => b.checkin_date.localeCompare(a.checkin_date))[0]
          earned.push({
            id: c.id,
            challenge_id: c.id,
            title: c.title,
            icon: c.icon,
            category: c.category,
            duration_days: c.duration_days,
            earned_at: lastCheckin?.checkin_date ?? '',
          })
        }
      }

      setBadges(earned)
      setLoading(false)
    }

    load()
  }, [userId])

  if (loading) return (
    <div className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.heading}>Badges</h2>
      </div>
      <div className={styles.skeleton}>
        {[1,2,3].map(i => <div key={i} className={styles.skeletonCard} />)}
      </div>
    </div>
  )

  const display = expanded ? badges : badges.slice(0, 6)

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.heading}>Badges</h2>
          <p className={styles.sub}>Challenges you've fully completed</p>
        </div>
        {badges.length > 0 && (
          <div className={styles.count}>{badges.length} earned</div>
        )}
      </div>

      {badges.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🏅</div>
          <div className={styles.emptyTitle}>No badges yet</div>
          <div className={styles.emptySub}>Complete all days of a challenge to earn your first badge.</div>
        </div>
      ) : (
        <>
          <div className={styles.grid}>
            {display.map((badge, i) => (
              <div
                key={badge.id}
                className={styles.card}
                style={{ animationDelay: `${i * 0.06}s` }}
              >
                <div className={styles.iconWrap}>
                  <span className={styles.icon}>{badge.icon}</span>
                  <div className={styles.shimmer} />
                </div>
                <div className={styles.cardTitle}>{badge.title}</div>
                <div className={styles.cardMeta}>
                  <span>{badge.duration_days}d · {badge.category}</span>
                </div>
                <div className={styles.earnedDate}>
                  {new Date(badge.earned_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
                <div className={styles.completedPill}>✓ Completed</div>
              </div>
            ))}
          </div>

          {badges.length > 6 && (
            <button className={styles.showMore} onClick={() => setExpanded(e => !e)}>
              {expanded ? 'Show less ↑' : `Show all ${badges.length} badges ↓`}
            </button>
          )}
        </>
      )}
    </div>
  )
}