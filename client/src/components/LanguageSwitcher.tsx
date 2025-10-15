import { useTranslation } from 'react-i18next'

const languages = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' }
]

export function LanguageSwitcher () {
  const { i18n, t } = useTranslation()

  const changeLanguage = (code: string) => {
    void i18n.changeLanguage(code)
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="font-medium text-slate-600">{t('app.language')}</span>
      <div className="flex gap-1 bg-white rounded-full shadow-inner px-1 py-1">
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => changeLanguage(lang.code)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
              i18n.language.startsWith(lang.code)
                ? 'bg-primary text-white shadow'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {lang.label}
          </button>
        ))}
      </div>
    </div>
  )
}
