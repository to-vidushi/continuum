'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './Auth.module.css'
import { supabase } from '@/lib/supabaseClient'

export default function AuthPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const signUp = async () => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    })
    if (error) alert(error.message)
    else alert('Signup success! Check Supabase Users.')
  }

  const signIn = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) alert(error.message)
    else router.push('/')
  }

  return (
    <div className={styles.container}>
      <div className={styles.formWrapper}>
        <h1>Auth</h1>

        <input
          className={styles.input}
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />

        <input
          className={styles.input}
          placeholder="Password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />

        <button onClick={signUp} className={styles.button}>Sign Up</button>
        <button onClick={signIn} className={styles.button}>Sign In</button>
      </div>
    </div>
  )
}