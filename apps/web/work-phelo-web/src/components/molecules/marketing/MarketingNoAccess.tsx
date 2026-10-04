export function MarketingNoAccess() {
  return (
    <div className="flex flex-1 items-center justify-center p-8 text-center">
      <div>
        <p className="text-base font-semibold text-gray-800">You don’t have access to this page</p>
        <p className="mt-1 text-sm text-gray-500">
          Ask your administrator for the permission if you need it.
        </p>
      </div>
    </div>
  );
}
