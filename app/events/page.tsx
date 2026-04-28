export default function EventExplorerPage() {
  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Event Explorer</h1>
            <p className="mt-1 text-gray-500">
              Browse, filter, and score conferences and meetups relevant to Plakar.
            </p>
          </div>
          <button
            disabled
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg opacity-50 cursor-not-allowed"
          >
            + Add Event
          </button>
        </div>

        {/* Filters placeholder */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 shadow-sm">
          <div className="flex flex-wrap gap-3">
            {["Region", "Event Type", "Date Range", "Score", "Status"].map((f) => (
              <div
                key={f}
                className="h-9 px-4 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-400 flex items-center"
              >
                {f}
              </div>
            ))}
          </div>
        </div>

        {/* Empty state */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">No events yet</h3>
            <p className="text-sm text-gray-500 max-w-sm">
              Phase 2 will add AI-powered event discovery, scoring, and ROI estimation.
              Events sourced from Luma and web crawling will appear here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
