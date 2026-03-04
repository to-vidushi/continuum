import { supabase } from './supabaseClient'

export type ReviewContent = {
  summary: string
  wins: string
  patterns: string
  carry_forward: string
}

export type WeeklyReview = {
  id: string
  user_id: string
  week_start: string
  week_end: string
  content: ReviewContent
  week_score: number
  mood: 'heavy' | 'neutral' | 'energised'
  generated_at: string
}

/** Get all reviews for current user, newest first */
export async function getAllReviews(): Promise<WeeklyReview[]> {
  const { data, error } = await supabase
    .from('weekly_reviews')
    .select('*')
    .order('week_start', { ascending: false })
  if (error) throw error
  return data as WeeklyReview[]
}

/** Get the review for a specific week_start date */
export async function getReviewForWeek(weekStart: string): Promise<WeeklyReview | null> {
  const { data, error } = await supabase
    .from('weekly_reviews')
    .select('*')
    .eq('week_start', weekStart)
    .maybeSingle()
  if (error) throw error
  return data as WeeklyReview | null
}

/** Get the Monday date string for the current week */
export function getCurrentWeekStart(): string {
  const now = new Date()
  const day = now.getDay() // 0=Sun
  const diff = day === 0 ? -6 : 1 - day // adjust to Monday
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  return monday.toISOString().split('T')[0]
}

/** Get the Sunday date string for a given Monday */
export function getWeekEnd(weekStart: string): string {
  const d = new Date(weekStart)
  d.setDate(d.getDate() + 6)
  return d.toISOString().split('T')[0]
}

/** Format a week range for display e.g. "Mar 3 – Mar 9, 2026" */
export function formatWeekRange(weekStart: string, weekEnd: string): string {
  const s = new Date(weekStart)
  const e = new Date(weekEnd)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`
}