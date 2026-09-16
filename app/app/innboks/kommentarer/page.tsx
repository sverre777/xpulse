import { getInboxComments, getInboxViewer } from '@/app/actions/inbox'
import { CommentFeedList } from '@/components/inbox/CommentFeedList'

export default async function InboxCommentsPage() {
  const [res, viewer] = await Promise.all([getInboxComments(), getInboxViewer()])
  if ('error' in res) {
    return (
      <p className="text-xs py-4"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>
        {res.error}
      </p>
    )
  }
  const rolle = 'error' in viewer ? 'athlete' : viewer.activeRole
  return <CommentFeedList comments={res} rolle={rolle} />
}
