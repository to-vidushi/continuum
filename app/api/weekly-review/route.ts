import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const GROQ_API_KEY = process.env.GROQ_API_KEY!

// ── Helpers ────────────────────────────────────────────────────────────────

function getWeekEnd(weekStart: string): string {
  const d = new Date(weekStart)
  d.setDate(d.getDate() + 6)
  return d.toISOString().split('T')[0]
}

function computeWeekScore(
  habitsDone: number,
  habitsTotal: number,
  winsDone: number,
  winsTotal: number,
  journalDays: number
): number {
  const habitPct   = habitsTotal > 0 ? (habitsDone / habitsTotal) : 0
  const winsPct    = winsTotal   > 0 ? (winsDone   / winsTotal)   : 0
  const journalPct = journalDays / 7
  const score = Math.round((habitPct * 40) + (winsPct * 40) + (journalPct * 20))
  return Math.min(100, Math.max(0, score))
}

// ── POST /api/weekly-review ────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { userId, weekStart } = await req.json()

    if (!userId || !weekStart) {
      return NextResponse.json({ error: 'Missing userId or weekStart' }, { status: 400 })
    }

    const weekEnd = getWeekEnd(weekStart)

    // ── 1. Fetch all data for the week in parallel ──────────────────────

    const participantRes = await supabase
      .from('challenge_participants')
      .select('challenge_id')
      .eq('user_id', userId)

    const challengeIds = participantRes.data?.map(p => p.challenge_id) ?? []

    const [
      { data: journalEntries },
      { data: dailyWins },
      { data: habits },
      { data: habitCompletions },
      { data: challengeCheckins },
      { data: challenges },
    ] = await Promise.all([
      supabase
        .from('journal_entries')
        .select('entry_date, content')
        .eq('user_id', userId)
        .gte('entry_date', weekStart)
        .lte('entry_date', weekEnd)
        .order('entry_date'),

      supabase
        .from('daily_wins')
        .select('title, category, completed, win_date')
        .eq('user_id', userId)
        .gte('win_date', weekStart)
        .lte('win_date', weekEnd),

      supabase
        .from('habits')
        .select('id, name, category, frequency, icon')
        .eq('user_id', userId),

      supabase
        .from('habit_completions')
        .select('habit_id, completed_date')
        .eq('user_id', userId)
        .gte('completed_date', weekStart)
        .lte('completed_date', weekEnd),

      challengeIds.length > 0
        ? supabase
            .from('challenge_checkins')
            .select('challenge_id, checkin_date')
            .eq('user_id', userId)
            .gte('checkin_date', weekStart)
            .lte('checkin_date', weekEnd)
        : Promise.resolve({ data: [] }),

      challengeIds.length > 0
        ? supabase
            .from('challenges')
            .select('id, title, icon, category')
            .in('id', challengeIds)
        : Promise.resolve({ data: [] }),
    ])

    // ── 2. Compute week score ───────────────────────────────────────────

    const dailyHabits = (habits ?? []).filter(h => h.frequency === 'daily')
    const habitsTotal = dailyHabits.length * 7
    const habitsDone  = (habitCompletions ?? []).length
    const winsTotal   = (dailyWins ?? []).length
    const winsDone    = (dailyWins ?? []).filter(w => w.completed).length
    const journalDays = (journalEntries ?? []).length

    const weekScore = computeWeekScore(habitsDone, habitsTotal, winsDone, winsTotal, journalDays)

    // ── 3. Build prompt ─────────────────────────────────────────────────

    const journalText = journalEntries?.length
      ? journalEntries.map(e => `${e.entry_date}: "${e.content}"`).join('\n')
      : 'No journal entries this week.'

    const winsText = dailyWins?.length
      ? `Planned: ${winsTotal}, Completed: ${winsDone} (${Math.round((winsDone / Math.max(winsTotal, 1)) * 100)}%)\n` +
        (dailyWins ?? []).filter(w => w.completed).slice(0, 10).map(w => `✓ [${w.category}] ${w.title}`).join('\n')
      : 'No daily wins recorded.'

    const habitsText = habits?.length
      ? habits.map(h => {
          const done  = (habitCompletions ?? []).filter(c => c.habit_id === h.id).length
          const total = h.frequency === 'daily' ? 7 : h.frequency === 'weekly' ? 1 : 0
          return `${h.icon} ${h.name} (${h.frequency}): ${done}/${total} days`
        }).join('\n')
      : 'No habits tracked.'

    const challengesText = challenges?.length
      ? challenges.map(c => {
          const checkins = (challengeCheckins ?? []).filter(ck => ck.challenge_id === c.id).length
          return `${c.icon} ${c.title}: ${checkins} check-ins this week`
        }).join('\n')
      : 'No active challenges.'

    const prompt = `You are a personal growth coach reviewing someone's week. Be warm, honest, specific and concise. Avoid generic advice. Base everything on the actual data provided.

WEEK: ${weekStart} to ${weekEnd}
WEEK SCORE: ${weekScore}/100

JOURNAL ENTRIES:
${journalText}

DAILY WINS (${winsDone}/${winsTotal} completed):
${winsText}

HABITS:
${habitsText}

CHALLENGES:
${challengesText}

Write a weekly review with EXACTLY these 4 sections. Return ONLY valid JSON, no markdown, no preamble, no backticks:

{
  "summary": "2-3 sentences. What kind of week was this overall? Be specific to their data, not generic.",
  "wins": "2-3 sentences. What actually went well? Reference specific wins, habits or journal moments.",
  "patterns": "2-3 sentences. What patterns do you notice? Look for correlations between journal tone and habit completion, or recurring themes.",
  "carry_forward": "1-2 sentences. One specific, actionable thing to focus on next week. Make it concrete.",
  "mood": "one word only: heavy, neutral, or energised — inferred from journal tone and completion rates"
}`

    // ── 4. Call Groq API ────────────────────────────────────────────────

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 800,
      }),
    })

    if (!groqRes.ok) {
      const err = await groqRes.text()
      console.error('Groq error:', err)
      return NextResponse.json({ error: 'Groq API failed', detail: err }, { status: 500 })
    }

    const groqData = await groqRes.json()
    const rawText  = groqData.choices?.[0]?.message?.content ?? ''

    // ── 5. Parse response ───────────────────────────────────────────────

    let parsed: {
      summary: string
      wins: string
      patterns: string
      carry_forward: string
      mood: string
    }

    try {
      const clean = rawText.replace(/```json|```/g, '').trim()
      parsed = JSON.parse(clean)
    } catch {
      console.error('Failed to parse Groq response:', rawText)
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
    }

    const mood = ['heavy', 'neutral', 'energised'].includes(parsed.mood)
      ? parsed.mood
      : 'neutral'

    const content = {
      summary:       parsed.summary       ?? '',
      wins:          parsed.wins          ?? '',
      patterns:      parsed.patterns      ?? '',
      carry_forward: parsed.carry_forward ?? '',
    }

    // ── 6. Save to Supabase ─────────────────────────────────────────────

    const { data: saved, error: saveErr } = await supabase
      .from('weekly_reviews')
      .upsert(
        {
          user_id:      userId,
          week_start:   weekStart,
          week_end:     weekEnd,
          content,
          week_score:   weekScore,
          mood,
          generated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,week_start' }
      )
      .select()
      .single()

    if (saveErr) {
      console.error('Save error:', saveErr)
      return NextResponse.json({ error: 'Failed to save review' }, { status: 500 })
    }

    // ── 7. Return review + sidebar stats ───────────────────────────────

    return NextResponse.json({
      review: saved,
      stats: {
        habitsDone,
        habitsTotal,
        winsDone,
        winsTotal,
        journalDays,
        challengeCheckins: (challengeCheckins ?? []).length,
        weekScore,
      },
    })

  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}