'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import styles from './Auth.module.css'

export default function AuthPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const isSuccess = message.includes('Check')

  const handleSignUp = async () => {
    setLoading(true)
    setMessage('')
    const { error } = await supabase.auth.signUp({ email, password })
    setMessage(error ? error.message : 'Check your email to confirm your account.')
    setLoading(false)
  }

  const handleSignIn = async () => {
    setLoading(true)
    setMessage('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setMessage(error.message)
      setLoading(false)
    } else {
      router.refresh()
      router.push('/')
    }
  }

  const handleSubmit = () => {
    mode === 'signin' ? handleSignIn() : handleSignUp()
  }

  return (
    <div className={styles.root}>

      {/* Left panel */}
      <div className={styles.left}>
        <div className={styles.leftContent}>

          <div className={styles.logoRow}>
            <div className={styles.logoMark}>C</div>
            <span className={styles.logoText}>Continuum</span>
          </div>

          <div className={styles.heroCopy}>
            <h1 className={styles.heroTitle}>
              Build the life <br />
              <span className={styles.heroItalic}>you intend.</span>
            </h1>
            <p className={styles.heroSub}>
              Track habits, review progress, and stay accountable — without noise.
            </p>
          </div>

          <div className={styles.featureList}>
            {[
              'Daily wins tracking',
              'Habit streaks',
              'Weekly reviews',
              'Personal challenges',
            ].map(text => (
              <div key={text} className={styles.featureItem}>
                <span className={styles.dot} />
                <span className={styles.featureItemText}>{text}</span>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* Right panel */}
      <div className={styles.right}>
        <div className={styles.formBox}>

          <div className={styles.formHeader}>
            <h2 className={styles.formTitle}>
              {mode === 'signin' ? 'Welcome back' : 'Create account'}
            </h2>
            <p className={styles.formSub}>
              {mode === 'signin'
                ? 'Sign in to continue.'
                : 'Start tracking your progress.'}
            </p>
          </div>

          <div className={styles.fields}>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Email</label>
              <input
                className={styles.input}
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Password</label>
              <input
                className={styles.input}
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
            </div>

            {message && (
              <div
                className={`${styles.message} ${
                  isSuccess ? styles.messageSuccess : styles.messageError
                }`}
              >
                {message}
              </div>
            )}

            <button
              className={styles.submitBtn}
              onClick={handleSubmit}
              disabled={loading || !email || !password}
            >
              {loading
                ? 'Please wait…'
                : mode === 'signin'
                ? 'Sign In'
                : 'Create Account'}
            </button>
          </div>

          <div className={styles.toggleRow}>
            {mode === 'signin' ? (
              <span className={styles.toggleText}>
                Don’t have an account?{' '}
                <button
                  className={styles.toggleBtn}
                  onClick={() => {
                    setMode('signup')
                    setMessage('')
                  }}
                >
                  Sign up
                </button>
              </span>
            ) : (
              <span className={styles.toggleText}>
                Already have an account?{' '}
                <button
                  className={styles.toggleBtn}
                  onClick={() => {
                    setMode('signin')
                    setMessage('')
                  }}
                >
                  Sign in
                </button>
              </span>
            )}
          </div>

        </div>
      </div>

    </div>
  )
}