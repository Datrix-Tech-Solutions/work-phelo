import { useLeaveRequests } from '@/hooks/useLeave';
import { TabBar } from '@/components/molecules/shared/TabBar';

interface Props {
  activeTab: string;
  isManager: boolean;
  isEmployee: boolean;
  onTabChange: (tab: string) => void;
}

export function LeaveTabs({ activeTab, isManager, isEmployee, onTabChange }: Props) {
  const { data: pendingList = [] } = useLeaveRequests('PENDING', { enabled: isManager });

  const pendingCount = (pendingList as unknown[]).length;

  const tabs = [
    ...(isEmployee ? [{ key: 'my', label: 'My Leave' }] : []),
    ...(isManager ? [{ key: 'requests', label: 'Leave Requests', count: pendingCount }] : []),
  ];

  return <TabBar tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} />;
}
