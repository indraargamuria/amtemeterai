import * as React from "react"
import { cn } from "../../utils/cn"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-lg border border-brand-blue/10 bg-white/50 px-3 py-2 text-sm placeholder:text-brand-blue/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red/50 focus-visible:border-brand-blue/20 disabled:cursor-not-allowed disabled:opacity-50 transition-all dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus-visible:border-brand-blue/40",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
