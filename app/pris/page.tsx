import { redirect } from 'next/navigation'

// Prismodellen bor nå kun på landing-siden (/#priser). Beholder ruten for
// bakoverkomp + indekserte lenker — redirecter direkte til anker.
export default function PrisRedirect() {
  redirect('/#priser')
}
