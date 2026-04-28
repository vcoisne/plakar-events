const PROFILE_SECTIONS = [
  {
    title: "Company Overview",
    description: "Company name, description, and product lines.",
    fields: ["Company Name", "Description", "Products"],
  },
  {
    title: "Target Personas",
    description: "Define your ideal customer profiles for event audience matching.",
    fields: ["Persona 1", "Persona 2"],
  },
  {
    title: "Messaging & Positioning",
    description: "Key messages, value props, and positioning statements used for event strategy generation.",
    fields: ["Positioning Statement", "Key Messages"],
  },
  {
    title: "Target Regions",
    description: "Geographic focus areas to prioritize events by location.",
    fields: ["Primary Regions"],
  },
  {
    title: "Competitors",
    description: "Competitor list used to detect competitor signals at events.",
    fields: ["Competitor Names"],
  },
  {
    title: "Budget & ROI Parameters",
    description: "CPL targets, budget ranges, lead estimates, and deal values for ROI calculations.",
    fields: ["Avg Deal Value", "Lead-to-Opp Rate", "CPL Targets", "Budget Ranges"],
  },
];

export default function CompanyProfilePage() {
  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Company Profile</h1>
            <p className="mt-1 text-gray-500">
              Configure Plakar&apos;s profile to power AI scoring, ROI estimation, and strategy generation.
            </p>
          </div>
          <button
            disabled
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg opacity-50 cursor-not-allowed"
          >
            Save Changes
          </button>
        </div>

        <div className="space-y-6">
          {PROFILE_SECTIONS.map((section) => (
            <div
              key={section.title}
              className="bg-white border border-gray-200 rounded-xl shadow-sm p-6"
            >
              <h2 className="font-semibold text-gray-900 mb-1">{section.title}</h2>
              <p className="text-sm text-gray-500 mb-4">{section.description}</p>
              <div className="space-y-3">
                {section.fields.map((field) => (
                  <div key={field}>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      {field}
                    </label>
                    <div className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-400 px-3 flex items-center">
                      Not configured
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 bg-indigo-50 border border-indigo-200 rounded-xl p-5">
          <h2 className="font-semibold text-indigo-900 mb-1">Coming in Phase 2</h2>
          <p className="text-sm text-indigo-700">
            Full profile editing with AI-assisted messaging generation, persona builder,
            and competitor tracking configuration.
          </p>
        </div>
      </div>
    </div>
  );
}
