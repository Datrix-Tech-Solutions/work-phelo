import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { TabBar } from '@/components/molecules/shared/TabBar';

interface Props {
  activeTab: string;
  isManager: boolean;
  onTabChange: (tab: string) => void;
}

export function LeaveTabs({ activeTab, isManager, onTabChange }: Props) {
  const { data: pendingList = [] } = useQuery({
    queryKey: ['leave-requests-pending'],
    queryFn: () =>
      api
        .get('/hr/leave/requests', { params: { status: 'Pending', limit: 100 } })
        .then((r) => (Array.isArray(r.data) ? r.data : (r.data?.data ?? []))),
    enabled: isManager,
  });

  const pendingCount = (pendingList as unknown[]).length;

  const tabs = [
    { key: 'my', label: 'My Leave' },
    ...(isManager ? [{ key: 'requests', label: 'Leave Requests', count: pendingCount }] : []),
  ];

  return <TabBar tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} />;
}
