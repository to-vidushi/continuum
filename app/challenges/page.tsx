'use client'


import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import styles from './Challenges.module.css'
import ChallengeCompletePopup from '@/components/Challengecompletepopup'


// ── Types ──────────────────────────────────────────────


type Challenge = {
  id: string
  title: string
  description: string
  category: string
  icon: string
  duration_days: number
  start_date: string
  end_date: string
  is_active: boolean
  is_private: boolean
  invite_code: string | null
  created_by: string | null
  participant_count?: number
}


type Participant = {
  id: string
  challenge_id: string
  user_id: string
  anonymous_name: string
  completed: boolean
}


type Checkin = {
  id: string
  challenge_id: string
  user_id: string
  checkin_date: string
}


// ── Animal name generator ──────────────────────────────


const ANIMALS = [
  'Swift Fox', 'Bold Bear', 'Quiet Wolf', 'Sharp Hawk', 'Calm Deer',
  'Wild Tiger', 'Brave Lion', 'Dark Raven', 'Free Eagle', 'Lone Owl',
  'Fast Cheetah', 'Steel Rhino', 'Ghost Lynx', 'Iron Stag', 'Sage Crane',
  'Storm Falcon', 'Frost Elk', 'Blaze Panther', 'Stone Bison', 'Dawn Kite',
]


function generateAnonName(): string {
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)]
  const num = Math.floor(1000 + Math.random() * 9000)
  return `${animal}#${num}`
}


function generateInviteCode(): string {
  const words = ['STUDY', 'GRIND', 'FOCUS', 'HUSTLE', 'GROW', 'RISE', 'WIN', 'BUILD', 'PUSH', 'FLOW']
  const word = words[Math.floor(Math.random() * words.length)]
  const num = Math.floor(10 + Math.random() * 90)
  return `${word}${num}`
}


// ── Helpers ────────────────────────────────────────────


function today(): string {
  return new Date().toISOString().split('T')[0]
}


function daysRemaining(endDate: string): number {
  const end = new Date(endDate)
  const now = new Date()
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
}


function getDaysBetween(startDate: string, endDate: string): string[] {
  const days: string[] = []
  const curr = new Date(startDate)
  const end = new Date(endDate)
  while (curr <= end) {
    days.push(curr.toISOString().split('T')[0])
    curr.setDate(curr.getDate() + 1)
  }
  return days
}


const ICONS = ['⚡','🏃','🧘','📖','💪','🚶','📵','🙏','✍️','🎯','🥗','💧','🌅','🎨','🧠']
const CATEGORIES = ['Mind', 'Body', 'Spirit', 'Health', 'Learning', 'Other']


// ── Main component ─────────────────────────────────────


type Tab = 'browse' | 'my' | 'private'


export default function ChallengesPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('browse')


  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [myParticipations, setMyParticipations] = useState<Participant[]>([])
  const [myCheckins, setMyCheckins] = useState<Checkin[]>([])
  const [allCheckins, setAllCheckins] = useState<Checkin[]>([])
  const [allParticipants, setAllParticipants] = useState<Participant[]>([])


  const [selected, setSelected] = useState<Challenge | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [copied, setCopied] = useState(false)


  // ── Completion popup ──
  const [completedChallenge, setCompletedChallenge] = useState<Challenge | null>(null)


  // Join via invite code
  const [inviteInput, setInviteInput] = useState('')
  const [inviteError, setInviteError] = useState('')


  // Create form
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'Mind',
    icon: '⚡',
    duration_days: 7,
    is_private: false,
  })


  // ── Load ──────────────────────────────────────────


  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }
      setUserId(user.id)
      await loadAll(user.id)
      setLoading(false)
    }
    init()
  }, [])


  const loadAll = async (uid: string) => {
    const [{ data: cData }, { data: pData }, { data: ckData }, { data: allCkData }] = await Promise.all([
      supabase.from('challenges').select('*').eq('is_active', true).order('created_at'),
      supabase.from('challenge_participants').select('*'),
      supabase.from('challenge_checkins').select('*').eq('user_id', uid),
      supabase.from('challenge_checkins').select('*'),
    ])


    if (pData) {
      setAllParticipants(pData)
      setMyParticipations(pData.filter(p => p.user_id === uid))
    }
    if (ckData) setMyCheckins(ckData)
    if (allCkData) setAllCheckins(allCkData)
    if (cData && pData) {
      setChallenges(cData.map(c => ({
        ...c,
        participant_count: pData.filter(p => p.challenge_id === c.id).length,
      })))
    }
  }


  // ── Actions ────────────────────────────────────────


  const joinChallenge = async (challenge: Challenge) => {
    if (!userId || isJoined(challenge.id)) return
    setActionLoading(true)
    const anonName = generateAnonName()
   
    const { data } = await supabase
      .from('challenge_participants')
      .insert({ challenge_id: challenge.id, user_id: userId, anonymous_name: anonName })
      .select()
     
    if (data) {
      setMyParticipations(prev => [...prev, data[0]])
      setAllParticipants(prev => [...prev, data[0]])
      setChallenges(prev => prev.map(c =>
        c.id === challenge.id ? { ...c, participant_count: (c.participant_count || 0) + 1 } : c
      ))


      const newWins = []
      for (let i = 0; i < challenge.duration_days; i++) {
        const winDate = new Date()
        winDate.setDate(winDate.getDate() + i)
        newWins.push({
          user_id: userId,
          title: `Challenge: ${challenge.title}`,
          category: challenge.category,
          win_date: winDate.toISOString().split('T')[0],
          challenge_id: challenge.id,
          completed: false
        })
      }
     
      const { error } = await supabase.from('daily_wins').insert(newWins)
      if (error) console.error("Failed to populate daily wins:", error)
    }
    setActionLoading(false)
  }


  const leaveChallenge = async (challenge: Challenge) => {
    if (!userId) return
    setActionLoading(true)
   
    await supabase.from('challenge_participants')
      .delete().eq('challenge_id', challenge.id).eq('user_id', userId)
     
    await supabase.from('daily_wins')
      .delete()
      .eq('challenge_id', challenge.id)
      .eq('user_id', userId)


    setMyParticipations(prev => prev.filter(p => p.challenge_id !== challenge.id))
    setAllParticipants(prev => prev.filter(p => !(p.challenge_id === challenge.id && p.user_id === userId)))
    setChallenges(prev => prev.map(c =>
      c.id === challenge.id ? { ...c, participant_count: Math.max(0, (c.participant_count || 1) - 1) } : c
    ))
    setActionLoading(false)
  }


  // ── Updated checkIn — detects when all days are done ──
  const checkIn = async (challenge: Challenge) => {
    if (!userId || hasCheckedInToday(challenge.id)) return
    setActionLoading(true)
   
    const { data } = await supabase
      .from('challenge_checkins')
      .insert({ challenge_id: challenge.id, user_id: userId, checkin_date: today() })
      .select()
     
    if (data) {
      const updatedCheckins = [...myCheckins, data[0]]
      setMyCheckins(updatedCheckins)


      await supabase.from('daily_wins')
        .update({ completed: true })
        .eq('challenge_id', challenge.id)
        .eq('user_id', userId)
        .eq('win_date', today())


      // ✅ If this was the final day, show the completion popup
      const totalCheckins = updatedCheckins.filter(c => c.challenge_id === challenge.id).length
      if (totalCheckins >= challenge.duration_days) {
        setCompletedChallenge(challenge)
      }
    }
    setActionLoading(false)
  }


  const createChallenge = async () => {
    if (!userId || !form.title.trim()) return
    setActionLoading(true)
    const inviteCode = form.is_private ? generateInviteCode() : null
    const { data } = await supabase
      .from('challenges')
      .insert({
        ...form,
        start_date: today(),
        invite_code: inviteCode,
        created_by: userId,
      })
      .select()


    if (data) {
      const newChallenge = { ...data[0], participant_count: 0 }
      setChallenges(prev => [...prev, newChallenge])
      await joinChallenge(newChallenge)
      setShowCreate(false)
      setForm({ title: '', description: '', category: 'Mind', icon: '⚡', duration_days: 7, is_private: false })
      setSelected(newChallenge)
    }
    setActionLoading(false)
  }


  const joinViaCode = async () => {
    if (!userId || !inviteInput.trim()) return
    setInviteError('')
    setActionLoading(true)


    const { data: challenge } = await supabase
      .from('challenges')
      .select('*')
      .eq('invite_code', inviteInput.trim().toUpperCase())
      .eq('is_active', true)
      .single()


    if (!challenge) {
      setInviteError('Invalid code. Check the code and try again.')
      setActionLoading(false)
      return
    }


    if (isJoined(challenge.id)) {
      setInviteError('You\'ve already joined this challenge.')
      setActionLoading(false)
      return
    }


    const enriched = { ...challenge, participant_count: allParticipants.filter(p => p.challenge_id === challenge.id).length }
    setChallenges(prev => prev.some(c => c.id === challenge.id) ? prev : [...prev, enriched])
    await joinChallenge(enriched)
    setInviteInput('')
    setTab('private')
    setActionLoading(false)
  }


  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }


  // ── Derived ────────────────────────────────────────


  const isJoined = (id: string) => myParticipations.some(p => p.challenge_id === id)
  const hasCheckedInToday = (id: string) => myCheckins.some(c => c.challenge_id === id && c.checkin_date === today())
  const getMyCheckins = (id: string) => myCheckins.filter(c => c.challenge_id === id)
  const getParticipants = (id: string) => allParticipants.filter(p => p.challenge_id === id)
  const getMyAnonName = (id: string) => myParticipations.find(p => p.challenge_id === id)?.anonymous_name ?? ''


  const getLeaderboard = (challengeId: string) => {
    const participants = allParticipants.filter(p => p.challenge_id === challengeId)
    return participants
      .map(p => ({
        ...p,
        checkinsCount: allCheckins.filter(c => c.challenge_id === challengeId && c.user_id === p.user_id).length,
        checkedToday: allCheckins.some(c => c.challenge_id === challengeId && c.user_id === p.user_id && c.checkin_date === today()),
      }))
      .sort((a, b) => b.checkinsCount - a.checkinsCount)
  }


  const publicChallenges = challenges.filter(c => !c.is_private)
  const myChallenges = challenges.filter(c => isJoined(c.id))
  const myPrivateChallenges = challenges.filter(c => c.is_private && isJoined(c.id))


  const displayedChallenges =
    tab === 'browse' ? publicChallenges :
    tab === 'my' ? myChallenges.filter(c => !c.is_private) :
    myPrivateChallenges


  // ── Render ─────────────────────────────────────────


  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#faf8f5' }}>
      <span style={{ color:'#aaa', fontSize:15 }}>Loading challenges…</span>
    </div>
  )


  return (
    <div className={styles.page}>


      {/* ── Completion popup ── */}
      {completedChallenge && (
        <ChallengeCompletePopup
          challenge={completedChallenge}
          onClose={() => setCompletedChallenge(null)}
        />
      )}


      {/* ── Detail modal ── */}
      {selected && (
        <div className={styles.overlay} onClick={() => setSelected(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <button className={styles.modalClose} onClick={() => setSelected(null)}>×</button>


            <div className={styles.modalIcon}>{selected.icon}</div>
            <h2 className={styles.modalTitle}>{selected.title}</h2>
            {selected.is_private && (
              <span className={`${styles.cardBadge} ${styles.badgePrivate}`}>🔒 Private</span>
            )}
            <p className={styles.modalDesc}>{selected.description}</p>


            {/* Stats */}
            <div className={styles.modalStats}>
              <div className={styles.statBox}>
                <div className={styles.statBoxValue}>{selected.duration_days}</div>
                <div className={styles.statBoxLabel}>Total days</div>
              </div>
              <div className={styles.statBox}>
                <div className={styles.statBoxValue}>{daysRemaining(selected.end_date)}</div>
                <div className={styles.statBoxLabel}>Days left</div>
              </div>
              <div className={styles.statBox}>
                <div className={styles.statBoxValue}>{selected.participant_count ?? 0}</div>
                <div className={styles.statBoxLabel}>Participants</div>
              </div>
            </div>


            {/* Invite code (private only) */}
            {selected.is_private && selected.invite_code && isJoined(selected.id) && (
              <div>
                <div className={styles.sectionLabel}>Invite code — share this</div>
                <div className={styles.inviteBox}>
                  <span className={styles.inviteCode}>{selected.invite_code}</span>
                  <button className={styles.copyBtn} onClick={() => copyCode(selected.invite_code!)}>
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            )}


            {/* Leaderboard */}
            <div>
              <div className={styles.sectionLabel}>Leaderboard</div>
              {getLeaderboard(selected.id).length === 0 ? (
                <span style={{ color:'#bbb', fontSize:13 }}>No one yet — be the first!</span>
              ) : (
                <div className={styles.leaderboard}>
                  {getLeaderboard(selected.id).map((p, i) => {
                    const pct = Math.round((p.checkinsCount / selected.duration_days) * 100)
                    const isYou = p.user_id === userId
                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`
                    return (
                      <div key={p.id} className={`${styles.leaderboardRow} ${isYou ? styles.leaderboardRowYou : ''}`}>
                        <span className={styles.leaderboardRank}>{medal}</span>
                        <div className={styles.leaderboardInfo}>
                          <div className={styles.leaderboardName}>
                            {p.anonymous_name}
                            {isYou && <span className={styles.leaderboardYouBadge}>you</span>}
                            {p.checkedToday && <span className={styles.leaderboardTodayBadge}>✓ today</span>}
                          </div>
                          <div className={styles.leaderboardBarBg}>
                            <div className={styles.leaderboardBarFill} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        <span className={styles.leaderboardScore}>
                          {p.checkinsCount}<span style={{ color:'#ccc', fontWeight:400 }}>/{selected.duration_days}</span>
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>


            {/* Check-in */}
            {isJoined(selected.id) && (
              <>
                <div>
                  <div className={styles.sectionLabel}>Today&apos;s check-in</div>
                  <div className={`${styles.checkinBox} ${hasCheckedInToday(selected.id) ? styles.checkinDone : ''}`}>
                    {hasCheckedInToday(selected.id) ? (
                      <>
                        <div style={{ fontSize:32 }}>✅</div>
                        <div className={styles.checkinTitle}>Done for today!</div>
                        <div className={styles.checkinSub}>
                          {getMyCheckins(selected.id).length} / {selected.duration_days} days completed
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize:32 }}>⏳</div>
                        <div className={styles.checkinTitle}>Did you do it today?</div>
                        <div className={styles.checkinSub}>
                          {getMyCheckins(selected.id).length} / {selected.duration_days} days so far
                        </div>
                        <button
                          className={`${styles.checkinBtn} ${styles.checkinBtnReady}`}
                          onClick={() => checkIn(selected)}
                          disabled={actionLoading}
                        >
                          ✓ Yes, I did it!
                        </button>
                      </>
                    )}
                  </div>
                </div>


                {/* Streak calendar */}
                <div>
                  <div className={styles.sectionLabel}>Your progress</div>
                  <div className={styles.calendar}>
                    {getDaysBetween(selected.start_date, selected.end_date).map((day, i) => {
                      const done = getMyCheckins(selected.id).some(c => c.checkin_date === day)
                      const isT = day === today()
                      const isFuture = day > today()
                      return (
                        <div key={day} title={day}
                          className={`${styles.calDay} ${done ? styles.calDayDone : isT ? styles.calDayToday : isFuture ? styles.calDayFuture : ''}`}
                        >
                          {i + 1}
                        </div>
                      )
                    })}
                  </div>
                </div>


                <button
                  className={`${styles.joinBtn} ${styles.joinBtnDanger}`}
                  onClick={() => { leaveChallenge(selected); setSelected(null) }}
                  disabled={actionLoading}
                >
                  Leave challenge
                </button>
              </>
            )}


            {!isJoined(selected.id) && (
              <button
                className={`${styles.joinBtn} ${styles.joinBtnPrimary}`}
                onClick={() => joinChallenge(selected)}
                disabled={actionLoading}
              >
                Join as {generateAnonName()} — anonymous
              </button>
            )}
          </div>
        </div>
      )}


      {/* ── Create modal ── */}
      {showCreate && (
        <div className={styles.overlay} onClick={() => setShowCreate(false)}>
          <div className={styles.createModal} onClick={e => e.stopPropagation()}>
            <button className={styles.modalClose} onClick={() => setShowCreate(false)}>×</button>
            <h2 className={styles.createTitle}>Create a Challenge</h2>


            <div className={styles.fieldGroup}>
              <label className={styles.label}>Title</label>
              <input className={styles.input} placeholder="e.g. Study 2 hours daily"
                value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>


            <div className={styles.fieldGroup}>
              <label className={styles.label}>Description</label>
              <textarea className={styles.textarea} placeholder="What's the challenge? How do you complete it each day?"
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>


            <div style={{ display:'flex', gap:12 }}>
              <div className={styles.fieldGroup} style={{ flex:1 }}>
                <label className={styles.label}>Category</label>
                <select className={styles.select} value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className={styles.fieldGroup} style={{ flex:1 }}>
                <label className={styles.label}>Duration (days)</label>
                <input className={styles.input} type="number" min={1} max={365}
                  value={form.duration_days} onChange={e => setForm(f => ({ ...f, duration_days: Number(e.target.value) }))} />
              </div>
            </div>


            <div className={styles.fieldGroup}>
              <label className={styles.label}>Icon</label>
              <div className={styles.iconGrid}>
                {ICONS.map(icon => (
                  <button key={icon} className={`${styles.iconOption} ${form.icon === icon ? styles.iconOptionSelected : ''}`}
                    onClick={() => setForm(f => ({ ...f, icon }))}>
                    {icon}
                  </button>
                ))}
              </div>
            </div>


            <div className={styles.fieldGroup}>
              <label className={styles.label}>Visibility</label>
              <div style={{ display:'flex', gap:10 }}>
                {[
                  { value: false, label: '🌍 Public', sub: 'Anyone can join' },
                  { value: true,  label: '🔒 Private', sub: 'Invite only via code' },
                ].map(opt => (
                  <button key={String(opt.value)}
                    onClick={() => setForm(f => ({ ...f, is_private: opt.value }))}
                    style={{
                      flex:1, padding:'10px 12px', borderRadius:10, cursor:'pointer', fontFamily:'inherit',
                      border: form.is_private === opt.value ? '2px solid #1a1a18' : '2px solid #e8e4dd',
                      background: form.is_private === opt.value ? '#1a1a18' : '#fdfcfa',
                      color: form.is_private === opt.value ? '#fff' : '#333',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontWeight:700, fontSize:14 }}>{opt.label}</div>
                    <div style={{ fontSize:11, opacity:0.7, marginTop:2 }}>{opt.sub}</div>
                  </button>
                ))}
              </div>
            </div>


            <button className={styles.submitBtn} onClick={createChallenge}
              disabled={actionLoading || !form.title.trim()}>
              {actionLoading ? 'Creating…' : `Create${form.is_private ? ' private' : ''} challenge`}
            </button>
          </div>
        </div>
      )}


      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.heading}>Challenges</h1>
          <p className={styles.headingSub}>Do hard things with strangers. Anonymously.</p>
        </div>
        <button className={styles.createBtn} onClick={() => setShowCreate(true)}>
          + Create challenge
        </button>
      </div>


      {/* Join via invite code */}
      <div className={styles.joinViaCode}>
        <div className={styles.joinViaCodeInner}>
          <span className={styles.joinViaCodeLabel}>🔒 Have an invite code?</span>
          <div className={styles.joinCodeRow} style={{ flex:1 }}>
            <input
              className={styles.joinCodeInput}
              placeholder="e.g. STUDYGRIND42"
              value={inviteInput}
              onChange={e => { setInviteInput(e.target.value); setInviteError('') }}
              onKeyDown={e => e.key === 'Enter' && joinViaCode()}
            />
            <button className={styles.joinCodeBtn} onClick={joinViaCode} disabled={actionLoading || !inviteInput.trim()}>
              Join
            </button>
          </div>
          {inviteError && <span style={{ fontSize:12, color:'#e8736c', width:'100%' }}>{inviteError}</span>}
        </div>
      </div>


      {/* Tabs */}
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'browse' ? styles.tabActive : ''}`} onClick={() => setTab('browse')}>
          Browse ({publicChallenges.length})
        </button>
        <button className={`${styles.tab} ${tab === 'my' ? styles.tabActive : ''}`} onClick={() => setTab('my')}>
          My Challenges ({myChallenges.filter(c => !c.is_private).length})
        </button>
        <button className={`${styles.tab} ${tab === 'private' ? styles.tabActive : ''}`} onClick={() => setTab('private')}>
          🔒 Private ({myPrivateChallenges.length})
        </button>
      </div>


      {/* Grid */}
      {displayedChallenges.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>{tab === 'private' ? '🔒' : '⚡'}</div>
          <div>
            {tab === 'browse' ? 'No public challenges right now.' :
             tab === 'my' ? "You haven't joined any public challenges yet." :
             "You have no private challenges. Create one and share the code with friends."}
          </div>
        </div>
      ) : (
        <div className={styles.grid}>
          {displayedChallenges.map(challenge => {
            const joined = isJoined(challenge.id)
            const checkedToday = hasCheckedInToday(challenge.id)
            const myCount = getMyCheckins(challenge.id).length
            const pct = joined ? Math.round((myCount / challenge.duration_days) * 100) : 0


            return (
              <button key={challenge.id}
                className={`${styles.card} ${joined ? styles.cardJoined : ''} ${challenge.is_private ? styles.cardPrivate : ''}`}
                onClick={() => setSelected(challenge)}
              >
                <div className={styles.cardTop}>
                  <span className={styles.cardIcon}>{challenge.icon}</span>
                  <div className={styles.badgeRow}>
                    {challenge.is_private && (
                      <span className={`${styles.cardBadge} ${styles.badgePrivate}`}>🔒 Private</span>
                    )}
                    <span className={`${styles.cardBadge} ${joined ? (checkedToday ? styles.badgeDone : styles.badgeJoined) : styles.badgeActive}`}>
                      {joined ? (checkedToday ? '✓ Done today' : 'Joined') : `${daysRemaining(challenge.end_date)}d left`}
                    </span>
                  </div>
                </div>


                <div className={styles.cardTitle}>{challenge.title}</div>
                <div className={styles.cardDesc}>{challenge.description}</div>


                {joined && (
                  <>
                    <div className={styles.progressBg}>
                      <div className={styles.progressFill} style={{ width:`${pct}%` }} />
                    </div>
                    <div className={styles.progressLabel}>{myCount} / {challenge.duration_days} days</div>
                  </>
                )}


                <div className={styles.cardMeta}>
                  <span className={styles.cardMetaItem}>👥 {challenge.participant_count ?? 0}</span>
                  <span className={styles.cardMetaItem}>📅 {challenge.duration_days}d</span>
                  <span className={styles.cardMetaItem}>🏷️ {challenge.category}</span>
                </div>


                <div className={`${styles.cardActionRow} ${joined ? styles.cardActionRowJoined : ''}`}>
                  {joined ? (checkedToday ? '✓ Checked in today' : '⏳ Check in today') : 'Join challenge →'}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

