'use client'

// FAVORITTER (Analyse v2 bolk 1, Sverre 5. sep): egen fane FØRST i Analyse og
// standard landing når brukeren har minst én favoritt. Kortene ligger i den
// rekkefølgen brukeren har dratt dem til (dnd-kit, gripepanel ⋮⋮, sort_order
// i user_favorite_charts), hvert kort har fane-chip, «Åpne i fane» og «Fjern»
// (synlig ved hover / alltid på touch). Perioden er den felles
// DateRangePicker-en øverst på siden. Trenervisning: lesing — treneren ser
// sine egne favoritter over utøverens data, uten drag og fjern.

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { DndContext, closestCenter, MouseSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { CSS as DndCSS } from '@dnd-kit/utilities'
import { FANE_NAVN, grafInfo, losGrafNokkel, dataForGraf, erSkyteGraf, type FaneKey, type DataKey } from '@/lib/graf-register'
import { useFavorites } from './FavoritesContext'
import { hentRenderer, type FavorittKontekst, type RenderFavoritt } from './favoritt-rendere'

const FONT = "'Barlow Condensed', sans-serif"

export function FavoritterTab({ dataFor, ctx, harSkiskyting, onOpenTab }: {
  /** Fanens datasett fra AnalysisPage-cachen (undefined = ikke hentet ennå). */
  dataFor: (k: DataKey) => unknown
  ctx: FavorittKontekst
  harSkiskyting: boolean
  onOpenTab: (fane: FaneKey) => void
}) {
  const { orderedKeys, toggle, reorder, readOnly, configs } = useFavorites()
  const keys = useMemo(() => orderedKeys.filter(k => harSkiskyting || !erSkyteGraf(k)), [orderedKeys, harSkiskyting])
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return
    const fra = orderedKeys.indexOf(String(e.active.id)), til = orderedKeys.indexOf(String(e.over.id))
    if (fra < 0 || til < 0) return
    void reorder(arrayMove(orderedKeys, fra, til))
  }

  if (keys.length === 0) {
    return (
      <div className="p-10 flex flex-col items-center text-center gap-2" data-favoritter-tom
        style={{ backgroundColor: 'var(--flate-12-alt)', border: '1px dashed var(--kant-3)' }}>
        <span aria-hidden="true" style={{ fontSize: 28, color: '#FF4500', lineHeight: 1 }}>★</span>
        <p style={{ fontFamily: FONT, color: 'var(--tekst-1-app)', fontSize: 15 }}>
          {readOnly ? 'Utøveren har ingen favoritter ennå.' : 'Marker grafer med ★ i fanene - de samles her.'}
        </p>
      </div>
    )
  }

  return (
    <div data-favoritter>
      <p className="mb-3 text-xs" style={{ fontFamily: FONT, color: 'var(--tekst-8-app)', letterSpacing: '0.06em' }}>
        {keys.length} {keys.length === 1 ? 'favoritt' : 'favoritter'}{readOnly ? ' · utøverens favoritter (lesing)' : ' · dra i ⋮⋮ for å endre rekkefølgen'}
      </p>
      {/* id: dnd-kit lager ellers aria-id-er med teller som spriker mellom server og klient (hydreringsfeil). */}
      <DndContext id="favoritt-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={keys} strategy={rectSortingStrategy} disabled={readOnly}>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4" data-favoritt-liste>
            {keys.map(key => (
              <FavorittKort key={key} chartKey={key} dataFor={dataFor} ctx={{ ...ctx, config: configs[key] ?? null }} readOnly={readOnly}
                onOpenTab={onOpenTab} onFjern={() => void toggle(key)} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}

function FavorittKort({ chartKey, dataFor, ctx, readOnly, onOpenTab, onFjern }: {
  chartKey: string
  dataFor: (k: DataKey) => unknown
  ctx: FavorittKontekst
  readOnly: boolean
  onOpenTab: (fane: FaneKey) => void
  onFjern: () => void
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: chartKey, disabled: readOnly })
  const key = losGrafNokkel(chartKey)
  const info = grafInfo(key)
  // Brede kort (statuskortet, oektsammenligningen) skal se ut som i sin egen
  // fane - de klemmes ikke inn i halv bredde paa PC (Sverre 6. sep).
  const bred = info?.bred === true
  const dataKey = dataForGraf(key)
  const faneKey = info?.fane ?? null
  // Fanens renderFavoritt lastes lazy; null = fanen har ingen (→ «Åpne i fane»).
  // Nøklene (strenger) som deps — grafInfo gir nytt objekt per render.
  const laster = useMemo(() => (faneKey ? hentRenderer(faneKey, dataKey) : null), [faneKey, dataKey])
  const [render, setRender] = useState<RenderFavoritt | null | undefined>(undefined)
  useEffect(() => {
    if (!laster) return
    let live = true
    laster.then(fn => { if (live) setRender(() => fn) }).catch(() => { if (live) setRender(null) })
    return () => { live = false }
  }, [laster])

  const data = dataKey && dataKey !== 'selv' ? dataFor(dataKey) : null
  const venter = (dataKey != null && dataKey !== 'selv' && data === undefined) || (laster != null && render === undefined)
  let innhold: ReactNode = null
  if (info && render && !venter) innhold = render(key, data, ctx)

  const fane = info?.fane ?? null
  const faneNavn = fane ? FANE_NAVN[fane] : 'Ukjent'
  const tittel = info?.tittel ?? chartKey
  return (
    <div ref={setNodeRef} className={`xp-fav-kort${bred ? ' xl:col-span-2' : ''}`} data-favoritt={chartKey} data-bred={bred || undefined} data-fane={fane ?? undefined} data-drar={isDragging || undefined}
      style={{ transform: DndCSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1, position: 'relative', zIndex: isDragging ? 5 : undefined, minWidth: 0 }}>
      <div className="flex items-center gap-2 mb-1.5 flex-wrap" style={{ fontFamily: FONT }}>
        {!readOnly && (
          <button type="button" ref={setActivatorNodeRef} {...listeners} {...attributes} aria-label={`Flytt «${tittel}»`} data-favoritt-grip
            style={{ background: 'none', border: '1px solid var(--line2)', borderRadius: 6, color: 'var(--tekst-8-app)', cursor: 'grab', padding: '2px 5px', fontSize: 13, lineHeight: 1, touchAction: 'none' }}>
            ⋮⋮
          </button>
        )}
        <span data-favoritt-fane style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, color: '#FF4500', border: '1px solid #FF450066', borderRadius: 999, padding: '1px 8px' }}>
          {faneNavn}
        </span>
        <span className="truncate" style={{ fontSize: 13, color: 'var(--tekst-5-app)', minWidth: 0 }}>{tittel}</span>
        <span className="flex-1" />
        {fane && fane !== 'favoritter' && (
          <button type="button" onClick={() => onOpenTab(fane)} data-favoritt-aapne
            style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontFamily: FONT, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '2px 4px' }}>
            Åpne i fane ↗
          </button>
        )}
        {!readOnly && (
          <button type="button" onClick={onFjern} className="xp-fav-fjern" data-favoritt-fjern aria-label={`Fjern «${tittel}» fra favoritter`}
            style={{ background: 'none', border: '1px solid var(--line2)', borderRadius: 6, color: 'var(--tekst-8-app)', cursor: 'pointer', fontFamily: FONT, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '2px 8px' }}>
            Fjern
          </button>
        )}
      </div>
      {innhold ?? (
        venter ? (
          <div className="py-10 text-center" style={{ border: '1px dashed var(--kant-3)' }}>
            <p className="text-xs tracking-widest uppercase" style={{ fontFamily: FONT, color: '#FF4500' }}>Laster {faneNavn.toLowerCase()}…</p>
          </div>
        ) : (
          <div className="p-5 flex items-center justify-between gap-4" data-favoritt-fallback
            style={{ backgroundColor: 'var(--flate-14)', border: '1px solid var(--kant-3)' }}>
            <div className="min-w-0">
              <p className="text-xs tracking-widest uppercase" style={{ fontFamily: FONT, color: 'var(--tekst-1-app)' }}>{tittel}</p>
              <p className="text-xs mt-0.5" style={{ fontFamily: FONT, color: 'var(--tekst-8-app)' }}>
                {info ? `Vises i fanen ${faneNavn} - åpne den for å se grafen.` : 'Ukjent graf - kan ha blitt fjernet.'}
              </p>
            </div>
            {fane && (
              <button type="button" onClick={() => onOpenTab(fane)} className="px-3 py-1.5 text-xs tracking-widest uppercase shrink-0"
                style={{ fontFamily: FONT, backgroundColor: 'transparent', border: '1px solid #FF4500', color: '#FF4500', minHeight: 36 }}>
                Åpne {faneNavn}
              </button>
            )}
          </div>
        )
      )}
    </div>
  )
}
