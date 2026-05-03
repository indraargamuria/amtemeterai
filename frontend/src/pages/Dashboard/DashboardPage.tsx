import { Card, CardContent, CardTitle } from "../../shared/components/ui/Card"

const metrics = [
  {
    title: "Ongoing Deliveries",
    value: "24",
    description: "Currently in transit",
  },
  {
    title: "Pending Invoice",
    value: "156",
    description: "Delivered but not invoiced",
  },
  {
    title: "e-Meterai Quota",
    value: "8,432",
    description: "Remaining stamps this month",
  },
]

export function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-brand-blue">Dashboard</h1>
        <p className="mt-1 text-sm text-brand-blue/60">
          Overview of your delivery operations
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {metrics.map((metric) => (
          <Card key={metric.title}>
            <CardContent className="p-6">
              <CardTitle className="text-base font-medium text-brand-blue/70 mb-2">
                {metric.title}
              </CardTitle>
              <p className="text-4xl font-bold text-brand-blue mb-1">
                {metric.value}
              </p>
              <p className="text-sm text-brand-blue/60">{metric.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity Section (Optional) */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-bold text-brand-blue mb-4">
            Recent Activity
          </h2>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between py-3 border-b border-brand-blue/5 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium text-brand-blue">
                    Delivery DLV-{1000 + i} completed
                  </p>
                  <p className="text-xs text-brand-blue/60">
                    Customer {i} • {i * 15} minutes ago
                  </p>
                </div>
                <span className="text-xs text-brand-blue/50">
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
