// HR MANAGEMENT ROLE MANAGEMENT PAGE //

'use client';

export default function RolesPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Roles & Permissions</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Create roles and define what each role can access and do
          </p>
        </div>
        <button className="px-4 py-2 bg-[#0D2244] text-white text-sm font-medium rounded-xl hover:bg-[#0D2244]/90 transition-colors">
          New Role
        </button>
      </div>

      {/* Content coming soon */}
      <div className="flex items-center justify-center h-64 rounded-2xl border-2 border-dashed border-gray-200">
        <p className="text-sm text-gray-400">Roles will appear here</p>
      </div>
    </div>
  );
}
