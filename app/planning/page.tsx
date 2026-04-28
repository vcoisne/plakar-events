const STATUS_COLUMNS = [
  { id: "candidate", label: "Candidates", color: "bg-gray-100 text-gray-700" },
  { id: "shortlisted", label: "Shortlisted", color: "bg-yellow-100 text-yellow-700" },
  { id: "approved", label: "Approved", color: "bg-green-100 text-green-700" },
  { id: "rejected", label: "Rejected", color: "bg-red-100 text-red-700" },
];

export default function PlanningBoardPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Planning Board</h1>
        <p className="mt-1 text-gray-500">
          Manage your event pipeline from candidates to approved sponsorships and appearances.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 overflow-x-auto">
        {STATUS_COLUMNS.map((col) => (
          <div key={col.id} className="flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${col.color}`}>
                {col.label}
              </span>
              <span className="text-xs text-gray-400">0</span>
            </div>

            <div className="flex-1 bg-gray-100 rounded-xl p-3 min-h-[400px]">
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <p className="text-sm text-gray-400">No events here yet.</p>
                <p className="text-xs text-gray-400 mt-1">
                  Events will appear after Phase 2 discovery.
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 bg-indigo-50 border border-indigo-200 rounded-xl p-5">
        <h2 className="font-semibold text-indigo-900 mb-1">Coming in Phase 2</h2>
        <p className="text-sm text-indigo-700">
          Drag-and-drop kanban board for event pipeline management, owner assignment,
          notes, and one-click Google Calendar export for approved events.
        </p>
      </div>
    </div>
  );
}
