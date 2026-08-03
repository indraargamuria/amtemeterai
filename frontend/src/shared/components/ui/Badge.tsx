import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../utils/cn"

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-brand-blue/10 text-brand-blue border border-brand-blue/20",
        outline: "border border-brand-blue/30 text-brand-blue/60 bg-white",
        accent: "bg-brand-red/10 text-brand-red border border-brand-red/20",
        success: "bg-emerald-50 text-emerald-700 border border-emerald-200",
        warning: "bg-amber-50 text-amber-700 border border-amber-200",
        info: "bg-brand-blue/5 text-brand-blue/70 border border-brand-blue/10",
        bc: "bg-emerald-50 text-emerald-800 border border-emerald-200",
        nonbc: "bg-slate-50 text-slate-600 border border-slate-200",
        other: "bg-violet-50 text-violet-700 border border-violet-200",
        badge: "bg-brand-blue/10 text-brand-blue rounded-md px-2 py-0.5",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
