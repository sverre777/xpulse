import { getInboxNotifications } from '@/app/actions/inbox'
import { NotificationList } from '@/components/inbox/NotificationList'

export default async function InboxNotificationsPage() {
  const res = await getInboxNotifications()
  if ('error' in res) {
    return (
      <p className="text-xs py-4"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>
        {res.error}
      </p>
    )
  }
  return <NotificationList notifications={res} />
}
