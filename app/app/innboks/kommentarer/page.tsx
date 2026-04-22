import { getInboxComments } from '@/app/actions/inbox'
import { CommentFeedList } from '@/components/inbox/CommentFeedList'

export default async function InboxCommentsPage() {
  const res = await getInboxComments()
  if ('error' in res) {
    return (
      <p className="text-xs py-4"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>
        {res.error}
      </p>
    )
  }
  return <CommentFeedList comments={res} />
}
