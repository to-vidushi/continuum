// continuum/app/api/send-reminders/route.ts
// Call this route to trigger reminder emails
// It checks who hasn't checked in today and emails them via Resend

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // needs service role to read auth.users
)

const RESEND_API_KEY = process.env.RESEND_API_KEY!
const FROM_EMAIL = 'onboarding@resend.dev' // ← keep this for local testing

function today(): string {
  return new Date().toISOString().split('T')[0]
}

function emailTemplate(
  userName: string,
  challenges: { title: string; icon: string; checkins: number; duration_days: number }[]
) {
  const challengeRows = challenges.map(c => {
    const pct = Math.round((c.checkins / c.duration_days) * 100)
    const barFilled = Math.round(pct / 10)
    const bar = '█'.repeat(barFilled) + '░'.repeat(10 - barFilled)
    return `
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid #f0ede7;">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:40px;height:40px;background:#1a1a18;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">
              ${c.icon}
            </div>
            <div style="flex:1;">
              <div style="font-size:15px;font-weight:600;color:#1a1a18;margin-bottom:4px;">${c.title}</div>
              <div style="font-family:monospace;font-size:11px;color:#aaa;letter-spacing:1px;">${bar} ${pct}%</div>
              <div style="font-size:12px;color:#bbb;margin-top:2px;">${c.checkins} of ${c.duration_days} days done</div>
            </div>
          </div>
        </td>
      </tr>
    `
  }).join('')

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Your daily challenge reminder</title>
</head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ef;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <tr>
            <td style="padding-bottom:28px;" align="center">
              <div style="display:inline-flex;align-items:center;gap:10px;">
                <div style="width:36px;height:36px;background:#e8736c;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:20px;font-weight:700;">C</div>
                <span style="font-size:20px;font-weight:700;color:#1a1a18;">Continuum</span>
              </div>
            </td>
          </tr>

          <tr>
            <td style="background:#fff;border-radius:20px;border:1px solid #ede9e2;padding:36px 36px 28px;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
              <h1 style="margin:0 0 6px;font-size:26px;font-weight:800;color:#1a1a18;">
                Hey ${userName} ⏰
              </h1>
              <p style="margin:0 0 28px;font-size:15px;color:#888;line-height:1.6;">
                It's 5:30 PM — time to check in on your challenges before the day slips away.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0">
                ${challengeRows}
              </table>

              <div style="margin-top:28px;text-align:center;">
                <a href="http://localhost:3000/challenges"
                   style="display:inline-block;background:#1a1a18;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:700;">
                  ✓ Check in now →
                </a>
              </div>

              <p style="margin:24px 0 0;font-size:13px;color:#bbb;text-align:center;line-height:1.6;">
                Don't break your streak. Every day counts. 🔥
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 0 0;text-align:center;">
              <p style="font-size:12px;color:#bbb;margin:0;">
                You're getting this because you joined a challenge on Continuum.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

export async function GET() {
  try {
    const todayStr = today()

    // 1. Get all participants
    const { data: participants, error: pErr } = await supabase
      .from('challenge_participants')
      .select('user_id, challenge_id')

    if (pErr || !participants?.length) {
      return NextResponse.json({ message: 'No participants found' })
    }

    // 2. Get today's check-ins
    const { data: todayCheckins } = await supabase
      .from('challenge_checkins')
      .select('user_id, challenge_id')
      .eq('checkin_date', todayStr)

    const checkedInSet = new Set(
      (todayCheckins ?? []).map(c => `${c.user_id}:${c.challenge_id}`)
    )

    // 3. Find who hasn't checked in today
    const { data: challenges_all } = await supabase
  .from('challenges')
  .select('id, duration_days')

const { data: allCheckinCounts } = await supabase
  .from('challenge_checkins')
  .select('user_id, challenge_id')

const needsReminder = participants.filter(p => {
  // Skip if already checked in today
  if (checkedInSet.has(`${p.user_id}:${p.challenge_id}`)) return false

  // Skip if challenge is already fully completed
  const challenge = challenges_all?.find(c => c.id === p.challenge_id)
  if (!challenge) return false
  const totalCheckins = (allCheckinCounts ?? []).filter(
    ck => ck.user_id === p.user_id && ck.challenge_id === p.challenge_id
  ).length
  if (totalCheckins >= challenge.duration_days) return false

  return true
})

    if (!needsReminder.length) {
      return NextResponse.json({ message: 'Everyone has checked in today!' })
    }

    // 4. Group by user
    const byUser: Record<string, string[]> = {}
    for (const p of needsReminder) {
      if (!byUser[p.user_id]) byUser[p.user_id] = []
      byUser[p.user_id].push(p.challenge_id)
    }

    const userIds = Object.keys(byUser)
    const allChallengeIds = [...new Set(needsReminder.map(p => p.challenge_id))]

    // 5. Get challenge details
    const { data: challenges } = await supabase
      .from('challenges')
      .select('id, title, icon, duration_days')
      .in('id', allChallengeIds)
      .eq('is_active', true)

    // 6. Get all checkin counts
    const { data: allCheckins } = await supabase
      .from('challenge_checkins')
      .select('user_id, challenge_id')
      .in('user_id', userIds)
      .in('challenge_id', allChallengeIds)

    // 7. Send emails
    const emailsSent: string[] = []

    for (const userId of userIds) {
      // Get user email via Supabase admin
      const { data: userData } = await supabase.auth.admin.getUserById(userId)
      const email = userData?.user?.email
      if (!email) continue

      const userName = email.split('@')[0]
      const userChallengeIds = byUser[userId]

      const userChallenges = userChallengeIds
        .map(cid => {
          const challenge = challenges?.find(c => c.id === cid)
          if (!challenge) return null
          const checkins = (allCheckins ?? []).filter(
            ck => ck.user_id === userId && ck.challenge_id === cid
          ).length
          return { ...challenge, checkins }
        })
        .filter(Boolean) as { title: string; icon: string; checkins: number; duration_days: number }[]

      if (!userChallenges.length) continue

      // Send via Resend
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: email,
          subject: `⏰ Don't forget to check in today — Continuum`,
          html: emailTemplate(userName, userChallenges),
        }),
      })

      if (res.ok) {
        emailsSent.push(email)
      } else {
        const err = await res.text()
        console.error(`Failed to send to ${email}:`, err)
      }
    }

    return NextResponse.json({
      success: true,
      sent: emailsSent.length,
      emails: emailsSent,
    })

  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}