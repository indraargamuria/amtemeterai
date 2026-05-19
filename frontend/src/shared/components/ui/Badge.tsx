import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../utils/cn"

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-brand-blue/10 text-brand-blue",
        outline: "border border-brand-blue/20 text-brand-blue",
        accent: "bg-brand-red/10 text-brand-red",
        success: "bg-emerald-10 text-emerald-700 border border-emerald/20",
        warning: "bg-amber-10 text-amber-700 border border-amber/20",
        info: "bg-brand-blue/5 text-brand-blue/70 border border-brand-blue/10",
        bc: "bg-emerald-5 text-emerald-800 border border-emerald/15",
        nonbc: "bg-slate-5 text-slate-600 border border-slate/15",
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
