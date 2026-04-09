export function SectionCard({
  title,
  children,
  scrollX,
}: {
  title: string;
  children: React.ReactNode;
  scrollX?: boolean;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-card overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </div>
      {scrollX ? (
        <div className="overflow-x-auto">
          <div className="flex gap-4 px-6 py-5" style={{ width: 'max-content', minWidth: '100%' }}>
            {children}
          </div>
        </div>
      ) : (
        <div className="px-6 py-5">{children}</div>
      )}
    </div>
  );
}
