'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

type Win = {
  id: string
  title: string
  created_at: string
}

export default function DailyWinsPage() {
  const [wins, setWins] = useState<Win[]>([])
  const [title, setTitle] = useState('')
  const router = useRouter()

  // 🔐 Check auth + load wins
  useEffect(() => {
    const loadWins = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/auth')
        return
      }

      const { data, error } = await supabase
        .from('daily_wins')
        .select('*')
        .order('created_at', { ascending: false })

      if (!error && data) {
        setWins(data)
      }
    }

    loadWins()
  }, [])

  // ➕ Add win
  const addWin = async () => {
    if (!title.trim()) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('daily_wins')
      .insert([
        { title, user_id: user.id }
      ])
      .select()

    if (!error && data) {
      setWins(prev => [...data, ...prev])
      setTitle('')
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Daily Wins 🌱</h1>

      <div style={{ marginBottom: 16 }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What did you win today?"
        />
        <button onClick={addWin}>Add</button>
      </div>

      <ul>
        {wins.map(win => (
          <li key={win.id}>{win.title}</li>
        ))}
      </ul>
    </div>
  )
}