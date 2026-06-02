import { redirect } from 'next/navigation'

// Abonnement er live (Stripe). Den gamle beta-placeholderen er fjernet —
// denne ruten redirecter til den faktiske abonnement-siden så gamle lenker
// og bokmerker fortsatt fungerer.
export default function AbonnementInnstillingerRedirect() {
  redirect('/app/abonnement')
}
