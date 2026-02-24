'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function AuthPage() {
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
    else alert('Login success!')
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Auth Test</h1>

      <input
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
      />

      <br /><br />

      <input
        placeholder="Password"
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
      />

      <br /><br />

      <button onClick={signUp}>Sign Up</button>
      <button onClick={signIn} style={{ marginLeft: 10 }}>
        Sign In
      </button>
    </div>
  )
}