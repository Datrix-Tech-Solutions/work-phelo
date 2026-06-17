export function AppearanceTab() {
  return (
    <div className="py-6 flex flex-col gap-10">
      <section>
        <h3 className="text-sm font-semibold text-gray-900">Company Logo</h3>
        <p className="text-sm text-gray-400 mt-0.5">Update your company logo</p>
      </section>

      <div className="border-t border-gray-100" />

      <section>
        <h3 className="text-sm font-semibold text-gray-900">Theme</h3>
        <p className="text-sm text-gray-400 mt-0.5">
          Customize the look and feel of your workspace
        </p>
      </section>
    </div>
  );
}
