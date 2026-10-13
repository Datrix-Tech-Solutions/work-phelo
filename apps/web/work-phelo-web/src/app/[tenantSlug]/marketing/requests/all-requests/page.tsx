'use client';

import { RequestsView } from '@/components/organisms/marketing/RequestsView';
import { ACTIVE_REQUEST_STATUSES } from '@/lib/requestOptions';

export default function AllRequestsPage() {
  return <RequestsView statuses={ACTIVE_REQUEST_STATUSES} allowCreate />;
}
