'use server'

import { createClient } from '@/lib/supabase/server'

// Søk på tvers av kategorier — kalles fra topplinjen via SearchModal.
//
// Mode bestemmer scope:
//   athlete: bare egne data (RLS sikrer dette automatisk).
//   coach:   kobler på utøver-data via RLS-policyene + viser "Utøvere"-kategori.
//
// Hver treff må returnere href slik at klienten kan navigere uten å vite om
// schema. Feil i én kategori skal ikke ta ned hele svaret — bruk Promise.allSettled.

export type SearchCategory =
  | 'workouts'
  | 'competitions'
  | 'comments'
  | 'tests'
  | 'templates'
  | 'athletes'

export interface SearchHit {
  id: string
  title: string
  subtitle: string | null
  date: string | null
  href: string
}

export type SearchResults = Partial<Record<SearchCategory, SearchHit[]>>

const PER_CATEGORY_LIMIT = 8

export async function searchAcrossCategories(
  rawQuery: string,
  opts: { mode: 'athlete' | 'coach'; category?: SearchCategory | 'all' } = { mode: 'athlete' },
): Promise<SearchResults> {
  const query = rawQuery.trim()
  if (query.length < 2) return {}

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return {}

  const like = `%${query.replace(/[%_]/g, m => '\\' + m)}%`
  const wanted = (cat: SearchCategory) =>
    !opts.category || opts.category === 'all' || opts.category === cat

  const tasks: Array<Promise<{ category: SearchCategory; hits: SearchHit[] } | null>> = []

  if (wanted('workouts')) {
    tasks.push((async () => {
      const { data } = await supabase
        .from('workouts')
        .select('id, title, sport, workout_type, date, notes, description, user_id')
        .or(
          `title.ilike.${like},notes.ilike.${like},description.ilike.${like},sport.ilike.${like}`,
        )
        .order('date', { ascending: false })
        .limit(PER_CATEGORY_LIMIT)
      if (!data) return { category: 'workouts' as const, hits: [] }
      const hits: SearchHit[] = data.map(w => ({
        id: w.id,
        title: w.title,
        subtitle: [w.sport, w.workout_type].filter(Boolean).join(' · '),
        date: w.date,
        href: `/app/dagbok?date=${encodeURIComponent(w.date)}`,
      }))
      return { category: 'workouts' as const, hits }
    })())

    // Tags er separat tabell; egen runde for å få med treff via tag.
    tasks.push((async () => {
      const { data } = await supabase
        .from('workout_tags')
        .select('tag, workout:workouts(id, title, date, sport)')
        .ilike('tag', like)
        .limit(PER_CATEGORY_LIMIT)
      if (!data) return null
      const hits: SearchHit[] = []
      for (const t of data) {
        const row = t as unknown as { tag: string; workout: { id: string; title: string; date: string; sport: string } | null }
        if (!row.workout) continue
        hits.push({
          id: `tag-${row.workout.id}`,
          title: row.workout.title,
          subtitle: `Tag: ${row.tag}`,
          date: row.workout.date,
          href: `/app/dagbok?date=${encodeURIComponent(row.workout.date)}`,
        })
      }
      return { category: 'workouts' as const, hits }
    })())
  }

  if (wanted('competitions')) {
    tasks.push((async () => {
      const { data } = await supabase
        .from('workout_competition_data')
        .select('id, name, location, comment, position_overall, workout:workouts(id, title, date)')
        .or(`name.ilike.${like},location.ilike.${like},comment.ilike.${like}`)
        .limit(PER_CATEGORY_LIMIT)
      if (!data) return { category: 'competitions' as const, hits: [] }
      const hits: SearchHit[] = []
      for (const c of data) {
        const row = c as unknown as {
          id: string; name: string | null; location: string | null
          position_overall: number | null
          workout: { id: string; title: string; date: string } | null
        }
        if (!row.workout) continue
        const subtitleParts = [row.location, row.position_overall ? `${row.position_overall}. plass` : null]
          .filter(Boolean) as string[]
        hits.push({
          id: row.id,
          title: row.name ?? row.workout.title,
          subtitle: subtitleParts.join(' · ') || null,
          date: row.workout.date,
          href: `/app/dagbok?date=${encodeURIComponent(row.workout.date)}`,
        })
      }
      return { category: 'competitions' as const, hits }
    })())
  }

  if (wanted('comments')) {
    tasks.push((async () => {
      const { data } = await supabase
        .from('coach_comments')
        .select('id, content, scope, period_key, context, created_at, athlete_id')
        .ilike('content', like)
        .order('created_at', { ascending: false })
        .limit(PER_CATEGORY_LIMIT)
      if (!data) return { category: 'comments' as const, hits: [] }
      const hits: SearchHit[] = data.map(c => ({
        id: c.id,
        title: snippet(c.content, query),
        subtitle: `${labelForContext(c.context)} · ${labelForScope(c.scope)}`,
        date: c.created_at?.slice(0, 10) ?? null,
        href: hrefForComment(c.context, c.scope, c.period_key),
      }))
      return { category: 'comments' as const, hits }
    })())
  }

  if (wanted('tests')) {
    tasks.push((async () => {
      const [testsRes, prsRes, templatesRes] = await Promise.all([
        supabase
          .from('workout_test_data')
          .select('id, test_type, sport, protocol_notes, equipment, conditions, workout:workouts(id, title, date)')
          .or(`test_type.ilike.${like},protocol_notes.ilike.${like},sport.ilike.${like},equipment.ilike.${like},conditions.ilike.${like}`)
          .limit(PER_CATEGORY_LIMIT),
        supabase
          .from('personal_records')
          .select('id, sport, record_type, value, unit, achieved_at, notes')
          .or(`record_type.ilike.${like},sport.ilike.${like},notes.ilike.${like}`)
          .order('achieved_at', { ascending: false })
          .limit(PER_CATEGORY_LIMIT),
        supabase
          .from('test_templates')
          .select('id, name, sport, test_type, protocol')
          .or(`name.ilike.${like},sport.ilike.${like},test_type.ilike.${like},protocol.ilike.${like}`)
          .limit(PER_CATEGORY_LIMIT),
      ])
      const hits: SearchHit[] = []
      for (const t of testsRes.data ?? []) {
        const row = t as unknown as {
          id: string; test_type: string; sport: string
          workout: { id: string; title: string; date: string } | null
        }
        hits.push({
          id: `test-${row.id}`,
          title: row.test_type,
          subtitle: `Test · ${row.sport}`,
          date: row.workout?.date ?? null,
          href: row.workout
            ? `/app/dagbok?date=${encodeURIComponent(row.workout.date)}`
            : '/app/analyse?tab=tester',
        })
      }
      for (const r of prsRes.data ?? []) {
        hits.push({
          id: `pr-${r.id}`,
          title: `${r.record_type}: ${r.value} ${r.unit}`,
          subtitle: `PR · ${r.sport}`,
          date: r.achieved_at,
          href: '/app/analyse?tab=tester',
        })
      }
      for (const tpl of templatesRes.data ?? []) {
        hits.push({
          id: `test-tpl-${tpl.id}`,
          title: tpl.name,
          subtitle: `Test-mal · ${tpl.sport}`,
          date: null,
          href: '/app/maler',
        })
      }
      return { category: 'tests' as const, hits: hits.slice(0, PER_CATEGORY_LIMIT * 2) }
    })())
  }

  if (wanted('templates')) {
    tasks.push((async () => {
      const [oktmal, plan, perio] = await Promise.all([
        supabase
          .from('workout_templates')
          .select('id, name')
          .ilike('name', like)
          .limit(PER_CATEGORY_LIMIT),
        supabase
          .from('plan_templates')
          .select('id, name, description, category')
          .or(`name.ilike.${like},description.ilike.${like},category.ilike.${like}`)
          .limit(PER_CATEGORY_LIMIT),
        supabase
          .from('periodization_templates')
          .select('id, name, description, category')
          .or(`name.ilike.${like},description.ilike.${like},category.ilike.${like}`)
          .limit(PER_CATEGORY_LIMIT),
      ])
      const hits: SearchHit[] = []
      for (const t of oktmal.data ?? []) {
        hits.push({ id: `om-${t.id}`, title: t.name, subtitle: 'Øktmal', date: null, href: '/app/maler' })
      }
      for (const t of plan.data ?? []) {
        hits.push({
          id: `pm-${t.id}`,
          title: t.name,
          subtitle: ['Plan-mal', t.category].filter(Boolean).join(' · '),
          date: null,
          href: '/app/maler',
        })
      }
      for (const t of perio.data ?? []) {
        hits.push({
          id: `pem-${t.id}`,
          title: t.name,
          subtitle: ['Periodiseringsmal', t.category].filter(Boolean).join(' · '),
          date: null,
          href: '/app/maler',
        })
      }
      return { category: 'templates' as const, hits }
    })())
  }

  if (opts.mode === 'coach' && wanted('athletes')) {
    tasks.push((async () => {
      const { data: relations } = await supabase
        .from('coach_athlete_relations')
        .select('athlete_id, status')
        .eq('coach_id', user.id)
        .eq('status', 'active')
      const athleteIds = (relations ?? []).map(r => r.athlete_id)
      if (athleteIds.length === 0) return { category: 'athletes' as const, hits: [] }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, primary_sport')
        .in('id', athleteIds)
        .or(`full_name.ilike.${like},email.ilike.${like},primary_sport.ilike.${like}`)
        .limit(PER_CATEGORY_LIMIT)

      const hits: SearchHit[] = (profiles ?? []).map(p => ({
        id: p.id,
        title: p.full_name ?? p.email ?? 'Ukjent utøver',
        subtitle: p.primary_sport ?? null,
        date: null,
        href: `/app/trener/${p.id}`,
      }))
      return { category: 'athletes' as const, hits }
    })())
  }

  const settled = await Promise.allSettled(tasks)

  const results: SearchResults = {}
  for (const r of settled) {
    if (r.status !== 'fulfilled' || !r.value) continue
    const { category, hits } = r.value
    if (hits.length === 0) continue
    const existing = results[category] ?? []
    // Merge + dedup by id, behold første forekomst.
    const seen = new Set(existing.map(h => h.id))
    const merged = [...existing]
    for (const h of hits) {
      if (seen.has(h.id)) continue
      seen.add(h.id)
      merged.push(h)
    }
    results[category] = merged.slice(0, PER_CATEGORY_LIMIT * 2)
  }

  return results
}

function snippet(text: string, query: string, maxLen = 80): string {
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text.slice(0, maxLen)
  const start = Math.max(0, idx - 20)
  const end = Math.min(text.length, idx + query.length + 40)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < text.length ? '…' : ''
  return prefix + text.slice(start, end) + suffix
}

function labelForScope(scope: string): string {
  switch (scope) {
    case 'day': return 'Dag'
    case 'week': return 'Uke'
    case 'month': return 'Måned'
    case 'workout': return 'Økt'
    default: return scope
  }
}

function labelForContext(context: string): string {
  switch (context) {
    case 'plan': return 'Plan'
    case 'dagbok': return 'Dagbok'
    case 'periodisering': return 'Periodisering'
    default: return context
  }
}

function hrefForComment(context: string, scope: string, periodKey: string): string {
  const base = context === 'plan' ? '/app/plan'
    : context === 'periodisering' ? '/app/periodisering'
    : '/app/dagbok'
  if (scope === 'day') return `${base}?date=${encodeURIComponent(periodKey)}`
  return base
}
