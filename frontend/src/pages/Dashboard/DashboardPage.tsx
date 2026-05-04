import { Card, CardContent } from "../../shared/components/ui/Card"

const metrics = [
  {
    title: "Ongoing Deliveries",
    value: "24",
    description: "Currently in transit",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  {
    title: "Pending Invoice",
    value: "156",
    description: "Delivered but not invoiced",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
  },
  {
    title: "e-Meterai Quota",
    value: "8,432",
    description: "Remaining stamps this month",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
        />
      </svg>
    ),
  },
]

export function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-brand-blue tracking-tight">
          Dashboard
        </h1>
        <p className="text-sm text-brand-blue/60">
          Overview of your delivery operations and key metrics
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {metrics.map((metric) => (
          <Card key={metric.title}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-brand-blue/50 uppercase tracking-wider">
                    {metric.title}
                  </p>
                  <p className="text-3xl font-bold text-brand-blue tracking-tight">
                    {metric.value}
                  </p>
                  <p className="text-sm text-brand-blue/60">
                    {metric.description}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-brand-blue/5 text-brand-blue/70">
                  {metric.icon}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity Section */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-sm font-semibold text-brand-blue uppercase tracking-wider mb-5">
            Recent Activity
          </h2>
          <div className="space-y-1">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between py-4 border-b border-brand-blue/5 last:border-0 last:pb-0 first:pt-0"
              >
                <div className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-blue/40 mt-2 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-brand-blue">
                      Delivery DLV-{1000 + i} completed
                    </p>
                    <p className="text-xs text-brand-blue/50 mt-0.5">
                      Customer {i} • {i * 15} minutes ago
                    </p>
                  </div>
                </div>
                <span className="text-xs text-brand-blue/40 whitespace-nowrap">
                  Today, {9 + i}:00 AM
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
