import { redirect } from 'next/navigation'

// «Helse og soner» er FLYTTET til Profil › Terskler, soner & helse
// (prestasjonsmodellen bolk 1). Ruta består som redirect så ingen
// gamle lenker dør — aldri to versjoner.
export default function HelseInnstillingerRedirect() {
  redirect('/app/innstillinger/profil/terskler')
}
