import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ athleteId: string }>
}

export default async function AthleteDefaultPage({ params }: Props) {
  const { athleteId } = await params
  redirect(`/app/trener/${athleteId}/plan`)
}
