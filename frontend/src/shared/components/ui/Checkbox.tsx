import { cn } from "../../utils/cn"

interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
  id?: string
}

export function Checkbox({ checked, onChange, disabled = false, className, id }: CheckboxProps) {
  return (
    <input
      type="checkbox"
      id={id}
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      disabled={disabled}
      className={cn(
        "h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:ring-offset-0",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "accent-brand-blue",
        className
      )}
    />
  )
}
