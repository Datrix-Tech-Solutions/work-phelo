import { pageHeader } from '@/lib/layout';

export default function CampaignsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0">
        <div className={pageHeader}>
          <h1 className="text-xl font-semibold text-gray-900">Campaigns</h1>
        </div>
      </div>

      <main className="flex-1 min-h-0 overflow-y-auto flex flex-col">{children}</main>
    </div>
  );
}
