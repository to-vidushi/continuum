import { supabase } from './supabaseClient';

export type KanbanProject = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
};

export type KanbanColumn = {
  id: string;
  project_id: string;
  title: string;
  position: number;
  emoji: string | null;
};

export type KanbanTask = {
  id: string;
  column_id: string;
  project_id: string;
  title: string;
  description: string | null;
  tags: string[];
  position: number;
  assignee_name: string | null;
  created_at: string;
};

// Projects
export async function getProjects() {
  const { data, error } = await supabase
    .from('kanban_projects')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as KanbanProject[];
}

export async function createProject(name: string, description: string) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('kanban_projects')
    .insert({ name, description, user_id: user!.id })
    .select()
    .single();
  if (error) throw error;
  return data as KanbanProject;
}

export async function deleteProject(id: string) {
  const { error } = await supabase.from('kanban_projects').delete().eq('id', id);
  if (error) throw error;
}

// Columns
export async function getColumns(projectId: string) {
  const { data, error } = await supabase
    .from('kanban_columns')
    .select('*')
    .eq('project_id', projectId)
    .order('position');
  if (error) throw error;
  return data as KanbanColumn[];
}

export async function createColumn(projectId: string, title: string, emoji: string = '') {
  const { data: cols } = await supabase
    .from('kanban_columns')
    .select('position')
    .eq('project_id', projectId)
    .order('position', { ascending: false })
    .limit(1);
  const position = cols && cols.length > 0 ? cols[0].position + 1 : 0;
  const { data, error } = await supabase
    .from('kanban_columns')
    .insert({ project_id: projectId, title, emoji, position })
    .select()
    .single();
  if (error) throw error;
  return data as KanbanColumn;
}

export async function deleteColumn(id: string) {
  const { error } = await supabase.from('kanban_columns').delete().eq('id', id);
  if (error) throw error;
}

// Tasks
export async function getTasks(projectId: string) {
  const { data, error } = await supabase
    .from('kanban_tasks')
    .select('*')
    .eq('project_id', projectId)
    .order('position');
  if (error) throw error;
  return data as KanbanTask[];
}

export async function createTask(
  columnId: string,
  projectId: string,
  title: string,
  description: string,
  tags: string[]
) {
  const { data: tasks } = await supabase
    .from('kanban_tasks')
    .select('position')
    .eq('column_id', columnId)
    .order('position', { ascending: false })
    .limit(1);
  const position = tasks && tasks.length > 0 ? tasks[0].position + 1 : 0;
  const { data, error } = await supabase
    .from('kanban_tasks')
    .insert({ column_id: columnId, project_id: projectId, title, description, tags, position })
    .select()
    .single();
  if (error) throw error;
  return data as KanbanTask;
}

export async function updateTaskColumn(taskId: string, columnId: string, position: number) {
  const { error } = await supabase
    .from('kanban_tasks')
    .update({ column_id: columnId, position })
    .eq('id', taskId);
  if (error) throw error;
}

export async function deleteTask(id: string) {
  const { error } = await supabase.from('kanban_tasks').delete().eq('id', id);
  if (error) throw error;
}