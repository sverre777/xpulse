'use client'

// Styrke bolk 8a: dra-og-slipp mellom øvelser - ÉN komponent for plan/dagbok
// (ActivitiesSection) og live (LiveSessionView), regel 11. dnd-kit som i
// kalenderen (ingen ny pakke). Draget går på HÅNDTAKET (grip ved nummeret),
// aldri hele kortet - ellers slåss det med scrollen på mobil. touch-action:
// none ligger bare på håndtaket. Opp/ned i ⋯-menyen beholdes som tastatur-
// og skjermleservei; håndtaket tar også piltastene.

import { DndContext, closestCenter, MouseSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS as DndCSS } from '@dnd-kit/utilities'
import { Ikon } from '@/components/ui/ikoner'

export interface OvelseGrip {
  dragRef: (el: HTMLElement | null) => void
  dragListeners?: Record<string, unknown>
  dragAttributes?: Record<string, unknown>
  dragging: boolean
}

/** Lista: mus etter 8 px, touch etter 250 ms hold (så et sveip scroller, et hold drar). */
export function OvelseListe({ ids, onFlytt, children }: { ids: string[]; onFlytt: (aktivId: string, overId: string | null) => void; children: React.ReactNode }) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  )
  const onDragEnd = (e: DragEndEvent) => onFlytt(String(e.active.id), e.over ? String(e.over.id) : null)
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>{children}</SortableContext>
    </DndContext>
  )
}

/** Wrapperen bærer transform/transition; kortet får håndtaket via grip. */
export function SorterbarOvelse({ id, children }: { id: string; children: (grip: OvelseGrip) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div ref={setNodeRef} data-sorterbar-ovelse={id} data-drar={isDragging || undefined}
      style={{ transform: DndCSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1, position: 'relative', zIndex: isDragging ? 5 : undefined }}>
      {children({ dragRef: setActivatorNodeRef, dragListeners: listeners as Record<string, unknown> | undefined, dragAttributes: attributes as unknown as Record<string, unknown>, dragging: isDragging })}
    </div>
  )
}

/** Håndtaket: 36 px treffflate, piltaster flytter (a11y). */
/** Feltene tas som SEPARATE props (ikke grip-objektet) - react-compiler-linten leser «x.dragRef» som ref-tilgang under render, jf. SorterbarRad i ActivitiesSection. */
export function OvelseHandtak({ dragRef, dragListeners, dragAttributes, dragging, onMove, storrelse = 36 }: OvelseGrip & { onMove?: (dir: -1 | 1) => void; storrelse?: number }) {
  return (
    <button type="button" ref={dragRef as React.Ref<HTMLButtonElement>} {...dragAttributes} {...dragListeners}
      data-ovelse-grip aria-label="Flytt øvelsen - dra, eller bruk piltastene"
      onKeyDown={e => {
        if (e.key === 'ArrowUp' && onMove) { e.preventDefault(); e.stopPropagation(); onMove(-1) }
        if (e.key === 'ArrowDown' && onMove) { e.preventDefault(); e.stopPropagation(); onMove(1) }
      }}
      style={{ background: 'none', border: 'none', padding: 0, cursor: dragging ? 'grabbing' : 'grab', color: 'var(--tekst-8-app)', minWidth: storrelse, minHeight: storrelse, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', touchAction: 'none', flex: 'none' }}>
      <Ikon navn="flytt" variant="strek" storrelse={18} />
    </button>
  )
}
