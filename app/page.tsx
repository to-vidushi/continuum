'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function Home() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth')
      } else {
        setLoading(false)
      }
    }
    checkUser()
  }, [router])

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>
  }

  return (
    <main className="flex flex-col min-h-screen items-center justify-center">
      <h1 className="text-2xl font-semibold">Continuum</h1>
      <p>Tested a Button Component</p>
      <button onClick={() => supabase.auth.signOut().then(() => router.push('/auth'))} className="mt-4 px-4 py-2 bg-slate-200 rounded hover:bg-slate-300 transition-colors">
        Sign Out
      </button>
    </main>
  );
}