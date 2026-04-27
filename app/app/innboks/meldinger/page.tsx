import Link from 'next/link'
import { after } from 'next/server'
import {
  getConversations,
  getThreadHeader,
  getThreadMessages,
  markThreadRead,
  getInboxViewer,
} from '@/app/actions/inbox'
import { ConversationList } from '@/components/inbox/ConversationList'
import { MessageThread } from '@/components/inbox/MessageThread'
import { NewMessageButton } from '@/components/inbox/NewMessageButton'

interface Props {
  searchParams: Promise<{ thread?: string; to?: string }>
}

export default async function InboxMessagesPage({ searchParams }: Props) {
  const { thread, to } = await searchParams
  const viewerRes = await getInboxViewer()
  if ('error' in viewerRes) {
    return (
      <p className="text-xs py-4"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>
        {viewerRes.error}
      </p>
    )
  }
  const viewer = viewerRes

  // Prioriter ?thread=... men støtt ?to=<userId> for å åpne en ny DM.
  const activeKey: string | null = thread ? thread : to ? `u:${to}` : null

  if (activeKey) {
    const [headerRes, messagesRes] = await Promise.all([
      getThreadHeader(activeKey),
      getThreadMessages(activeKey),
    ])

    if ('error' in headerRes) {
      return (
        <div>
          <Link
            href="/app/innboks/meldinger"
            className="text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}
          >
            ← Tilbake til meldinger
          </Link>
          <p className="text-xs py-4 mt-3"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>
            {headerRes.error}
          </p>
        </div>
      )
    }

    // Markér som lest etter at responsen er sendt — `markThreadRead` kaller
    // revalidatePath, som ikke kan kjøres under render i Next.js 16.
    after(() => markThreadRead(activeKey))

    const messages = 'error' in messagesRes ? [] : messagesRes
    const messagesError = 'error' in messagesRes ? messagesRes.error : null

    return (
      <MessageThread
        viewerId={viewer.userId}
        viewerIsCoach={viewer.hasCoachRole}
        header={headerRes}
        messages={messages}
        error={messagesError}
      />
    )
  }

  const convRes = await getConversations()
  if ('error' in convRes) {
    return (
      <p className="text-xs py-4"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>
        {convRes.error}
      </p>
    )
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <NewMessageButton viewerIsCoach={viewer.hasCoachRole} />
      </div>
      <ConversationList conversations={convRes} viewerId={viewer.userId} />
    </div>
  )
}
