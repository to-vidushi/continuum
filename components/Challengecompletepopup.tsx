'use client'

import { useEffect, useRef } from 'react'
import styles from './Challengecompletepopup.module.css'

type Props = {
  challenge: {
    title: string
    icon: string
    duration_days: number
    category: string
  }
  onClose: () => void
}

export default function ChallengeCompletePopup({ challenge, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Auto-close after 6 seconds
    const t = setTimeout(onClose, 6000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div className={styles.overlay}>
      <div className={styles.popup} ref={ref}>
        {/* Confetti dots */}
        {Array.from({ length: 24 }).map((_, i) => (
          <div key={i} className={styles.confetti} style={{
            '--i': i,
            '--x': `${Math.random() * 100}%`,
            '--delay': `${Math.random() * 0.4}s`,
            '--color': ['#f59e0b','#4ade80','#60a5fa','#f472b6','#fb923c','#a78bfa'][i % 6],
          } as React.CSSProperties} />
        ))}

        <div className={styles.iconRing}>
          <span className={styles.icon}>{challenge.icon}</span>
          <div className={styles.iconGlow} />
        </div>

        <div className={styles.label}>Challenge Complete</div>
        <h2 className={styles.title}>{challenge.title}</h2>
        <p className={styles.sub}>
          You crushed <strong>{challenge.duration_days} days</strong> straight.<br/>
          A new badge has been added to your collection.
        </p>

        <div className={styles.badgePreview}>
          <span className={styles.badgeIcon}>{challenge.icon}</span>
          <div className={styles.badgeText}>
            <div className={styles.badgeName}>{challenge.title}</div>
            <div className={styles.badgeMeta}>{challenge.duration_days}-day · {challenge.category}</div>
          </div>
          <span className={styles.badgeCheck}>✓</span>
        </div>

        <button className={styles.closeBtn} onClick={onClose}>
          Awesome! 🎉
        </button>

        <div className={styles.autoClose}>closes automatically…</div>
      </div>
    </div>
  )
}