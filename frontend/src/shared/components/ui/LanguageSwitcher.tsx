import { useTranslation } from 'react-i18next'
import { Globe } from 'lucide-react'
import { cn } from '../../utils/cn'

interface LanguageSwitcherProps {
  className?: string
}

export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const { i18n } = useTranslation()

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'id' : 'en'
    i18n.changeLanguage(newLang)
  }

  return (
    <button
      onClick={toggleLanguage}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-md bg-white border border-brand-blue/10 hover:border-brand-blue/20 transition-colors",
        className
      )}
      type="button"
      aria-label="Toggle language"
    >
      <Globe className="w-4 h-4 text-brand-blue" />
      <span className="text-sm font-medium text-brand-blue">
        {i18n.language === 'en' ? 'EN' : 'ID'}
      </span>
    </button>
  )
}
