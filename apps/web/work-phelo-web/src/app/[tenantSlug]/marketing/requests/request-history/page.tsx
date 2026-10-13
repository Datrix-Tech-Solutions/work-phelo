'use client';

import { RequestsView } from '@/components/organisms/marketing/RequestsView';
import { HISTORY_REQUEST_STATUSES } from '@/lib/requestOptions';

export default function RequestHistoryPage() {
  return <RequestsView statuses={HISTORY_REQUEST_STATUSES} showViewAction={false} />;
}
