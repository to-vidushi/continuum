import { supabase } from './supabaseClient';

export type JournalEntry = {
  id: string;
  user_id: string;
  entry_date: string;
  content: string;
  created_at: string;
};

/** Get today's entry for the current user, or null if none yet */
export async function getTodayEntry(): Promise<JournalEntry | null> {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('entry_date', today)
    .maybeSingle();
  if (error) throw error;
  return data as JournalEntry | null;
}

/** Save today's entry — inserts on first write, updates on edit */
export async function upsertTodayEntry(content: string): Promise<JournalEntry> {
  const today = new Date().toISOString().split('T')[0];
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('journal_entries')
    .upsert(
      { user_id: user.id, entry_date: today, content },
      { onConflict: 'user_id,entry_date' }
    )
    .select()
    .single();
  if (error) throw error;
  return data as JournalEntry;
}

/** Get all entries for the journal page, newest first */
export async function getAllEntries(): Promise<JournalEntry[]> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('*')
    .order('entry_date', { ascending: false });
  if (error) throw error;
  return data as JournalEntry[];
}