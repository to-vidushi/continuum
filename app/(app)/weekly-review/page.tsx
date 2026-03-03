'use client'

import styles from './WeeklyReview.module.css'

export default function WeeklyReviewPage() {
  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.iconWrap}>🗓️</div>
        <h1 className={styles.title}>Weekly Review</h1>
        <p className={styles.sub}>
          Your AI-powered weekly reflection is coming soon.
        </p>
        <p className={styles.desc}>
          At the end of each week, Continuum will automatically synthesise your
          daily wins, habits, journal entries and challenges into a meaningful
          review — showing patterns, wins, and things to carry forward.
        </p>
        <div className={styles.comingSoonPill}>Coming soon</div>
      </div>
    </div>
  )
}