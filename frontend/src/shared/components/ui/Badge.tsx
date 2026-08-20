import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../utils/cn"

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-brand-blue/10 text-brand-blue border border-brand-blue/20 dark:bg-brand-blue/20 dark:text-brand-blue",
        outline: "border border-brand-blue/30 text-brand-blue/60 bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-brand-blue",
        accent: "bg-brand-red/10 text-brand-red border border-brand-red/20",
        success: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-900",
        warning: "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-900",
        info: "bg-brand-blue/5 text-brand-blue/70 border border-brand-blue/10 dark:text-slate-300 dark:border-slate-700",
        bc: "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-900",
        nonbc: "bg-slate-50 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
        other: "bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-950 dark:text-violet-400 dark:border-violet-900",
        badge: "bg-brand-blue/10 text-brand-blue rounded-md px-2 py-0.5 dark:text-slate-100",
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
