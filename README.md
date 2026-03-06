# Continuum

> An all-in-one personal progress system — track wins, build habits, reflect, and stay consistent.

Built as a capstone project for the **WE Program by TalentSprint & Google**.

---

## Quick Navigation

- [Project Overview](#project-overview)
- [Features](#features)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running Locally](#running-locally)
- [Configuration](#configuration)
- [Architecture](#architecture)
- [Contributing](#contributing)
- [License](#license)

---

## Project Overview

Continuum is a full-stack web application designed to help individuals build better habits, track their daily progress, and reflect on their growth over time.

The idea is simple: every day you plan your wins, complete your habits, log your thoughts, and review your week. Over time, Continuum gives you a clear picture of your progress through visualisations, streaks, and AI-generated weekly reviews.

**Built with:** Next.js · TypeScript · Supabase · Groq AI · Recharts

**Team:**
Vidushi Bahuguna, Varshini Mallidi, Mani Harshitha Chintakunta

---

## Features

### Daily Wins
Plan your wins each morning across 6 life categories — Mind, Body, Spirit, Health, Learning, and Other. Check them off at night and view your daily score with star ratings.

### Habit Tracking
Create habits with custom icons, colors, and categories. Track current and longest streaks, view a 7-day mini heatmap per habit, and filter by daily, weekly, or monthly frequency. Completing a habit automatically syncs it as a completed win in Daily Wins.

### Visualisation
See your progress at a glance with:
- GitHub-style completion heatmaps per habit
- Streak comparison charts across all habits
- Daily wins line charts (planned vs completed)
- Category breakdown and completion rate charts
- Filter by last 7, 30, or 90 days

### Kanban Boards
Visual workflow boards to organise tasks and projects. Move cards across columns from idea to done.

### Journal
A daily journal to log your thoughts, reflections, and notes. Includes a dot indicator in the sidebar when you haven't logged today.

### Weekly Review
AI-powered weekly review generated using Groq. Automatically summarises your habits, wins, and journal entries from the past week into a structured reflection.

### Challenges
Anonymous group challenges to stay accountable alongside others worldwide. Complete challenges and earn badges.

---

## Getting Started

### Prerequisites

Make sure you have the following installed:

- [Node.js](https://nodejs.org/) version 18 or higher
- [npm](https://www.npmjs.com/) (comes with Node.js)
- A [Supabase](https://supabase.com) account (free)
- A [Groq](https://console.groq.com) account (free)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/continuum.git
   cd continuum
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up your environment variables**

   Create a `.env.local` file in the root of the project (see [Configuration](#configuration) for details).

4. **Set up the database**

   Go to your Supabase project → SQL Editor → New Query, and run:

   ```sql
   -- Habits
   create table if not exists habits (
     id uuid default gen_random_uuid() primary key,
     user_id uuid references auth.users(id) on delete cascade not null,
     name text not null,
     category text not null default 'General',
     frequency text not null default 'daily',
     color text not null default '#4a9e6b',
     icon text not null default '🔁',
     created_at timestamptz default now()
   );

   -- Habit completions
   create table if not exists habit_completions (
     id uuid default gen_random_uuid() primary key,
     habit_id uuid references habits(id) on delete cascade not null,
     user_id uuid references auth.users(id) on delete cascade not null,
     completed_date date not null default current_date,
     created_at timestamptz default now(),
     unique(habit_id, completed_date)
   );

   -- Enable RLS
   alter table habits enable row level security;
   alter table habit_completions enable row level security;

   -- Policies
   create policy "habits_select" on habits for select using (auth.uid() = user_id);
   create policy "habits_insert" on habits for insert with check (auth.uid() = user_id);
   create policy "habits_update" on habits for update using (auth.uid() = user_id);
   create policy "habits_delete" on habits for delete using (auth.uid() = user_id);
   create policy "completions_select" on habit_completions for select using (auth.uid() = user_id);
   create policy "completions_insert" on habit_completions for insert with check (auth.uid() = user_id);
   create policy "completions_delete" on habit_completions for delete using (auth.uid() = user_id);
   ```

### Running Locally

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

Other useful commands:

```bash
npm run build      # Build for production
npm run start      # Start production server
npm run lint       # Run linter
```

---

## Configuration

Create a `.env.local` file in the root of your project with the following variables:

```env
# Supabase — get these from supabase.com → your project → Settings → API Keys
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_public_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Groq — get this from console.groq.com → API Keys (free account)
GROQ_API_KEY=your_groq_api_key
```

| Variable | Description | Where to get it |
|----------|-------------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key for client-side access | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret key for server-side access | Supabase Dashboard → Settings → API |
| `GROQ_API_KEY` | API key for AI-powered weekly reviews | [console.groq.com](https://console.groq.com) |

> Never commit your `.env.local` file to GitHub. It is already listed in `.gitignore`.

---

## Architecture

Continuum follows a standard Next.js App Router structure with Supabase as the backend.

```
continuum/
├── app/
│   ├── (app)/               # Protected app pages (sidebar layout)
│   │   ├── daily-wins/      # Daily wins tracker
│   │   ├── habits/          # Habit tracking
│   │   ├── visualisation/   # Charts and heatmaps
│   │   ├── journal/         # Daily journal
│   │   ├── kanban/          # Kanban boards
│   │   ├── weekly-review/   # AI weekly review
│   │   └── challenges/      # Group challenges
│   ├── api/                 # API routes (server-side)
│   │   ├── weekly-review/   # Groq AI integration
│   │   └── send-reminders/  # Notification logic
│   ├── auth/                # Authentication page
│   └── page.tsx             # Dashboard
├── components/              # Shared UI components
├── lib/                     # Utility functions and Supabase client
└── public/                  # Static assets
```

**Key design decisions:**
- All app pages are inside `app/(app)/` and share a common sidebar layout
- Supabase Row Level Security (RLS) ensures users can only access their own data
- Habit completions automatically sync to Daily Wins for a unified view of daily activity
- The Weekly Review is generated server-side using the Groq API to keep the API key secure

---

## Contributing

This project was built collaboratively by a team of three as a capstone project.

If you'd like to contribute:

1. Fork the repository
2. Create a new branch
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Make your changes and commit
   ```bash
   git commit -m "feat: describe your change"
   ```
4. Push to your branch
   ```bash
   git push origin feature/your-feature-name
   ```
5. Open a Pull Request

---

## License

This project was built for educational purposes as part of the **WE Program by TalentSprint & Google**.

© 2026 Vidhushi Bahuguna, Varshini Mallidi, Mani Harshitha Chintakunta. All rights reserved.
