export default function DashboardPage() {
  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-gray-500">
            Your conference intelligence overview.
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Events Tracked", value: "—" },
            { label: "Shortlisted", value: "—" },
            { label: "Approved", value: "—" },
            { label: "Est. Pipeline", value: "—" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm"
            >
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Coming soon banner */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-6">
          <h2 className="font-semibold text-indigo-900 mb-2">Coming in Phase 2</h2>
          <ul className="text-sm text-indigo-700 space-y-1 list-disc list-inside">
            <li>AI-scored event recommendations based on your company profile</li>
            <li>ROI estimates per event with pipeline projections</li>
            <li>Competitor signal tracking across conferences</li>
            <li>One-click Google Calendar export for approved events</li>
            <li>Automated event discovery from Luma and the web</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
