export default function TenantLoginPage({ params }: { params: { tenantSlug: string } }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-sm border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">WorkPhelo</h1>
        <p className="text-gray-500 text-sm mb-8">Sign in to {params.tenantSlug}</p>
        <p className="text-center text-gray-400 text-sm">Login form coming soon</p>
      </div>
    </div>
  );
}
