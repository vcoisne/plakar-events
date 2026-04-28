interface EventDetailPageProps {
  params: { id: string };
}

export default function EventDetailPage({ params }: EventDetailPageProps) {
  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <a
            href="/events"
            className="text-sm text-indigo-600 hover:underline flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Event Explorer
          </a>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-6">
          <div className="h-8 w-64 bg-gray-100 rounded animate-pulse mb-2" />
          <div className="h-4 w-40 bg-gray-100 rounded animate-pulse" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {["AI Score Breakdown", "ROI Estimate", "Strategy Recommendation", "CFP Angles"].map((section) => (
              <div key={section} className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
                <h2 className="font-semibold text-gray-900 mb-3">{section}</h2>
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 text-sm text-indigo-700">
                  This section will be populated by AI analysis in Phase 2.
                </div>
              </div>
            ))}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Event Details</h3>
              {["Date", "Location", "Attendance", "Sponsorship Cost", "CFP Deadline"].map((field) => (
                <div key={field} className="flex justify-between py-2 border-b border-gray-100 last:border-0 text-sm">
                  <span className="text-gray-500">{field}</span>
                  <span className="text-gray-400">—</span>
                </div>
              ))}
            </div>

            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Planning Status</h3>
              <div className="text-sm text-gray-400">Not yet tracked</div>
            </div>
          </div>
        </div>

        <p className="mt-4 text-xs text-gray-400">Event ID: {params.id}</p>
      </div>
    </div>
  );
}
