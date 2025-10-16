import { useState } from 'react'
import { Tournament } from './api/tournaments'
import { TournamentForm } from './components/TournamentForm'
import { TournamentList } from './components/TournamentList'
import { TournamentDashboard } from './components/TournamentDashboard'
import { LanguageSwitcher } from './components/LanguageSwitcher'
import { useTranslation } from 'react-i18next'

function App () {
  const { t } = useTranslation()
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-12 space-y-8">
        <header className="flex flex-col gap-6 rounded-3xl bg-white p-8 shadow-xl border border-slate-100">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-2xl space-y-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1 text-xs font-semibold uppercase text-primary">
                ArenaFlow
              </span>
              <h1 className="text-4xl font-black text-slate-900 tracking-tight">{t('app.title')}</h1>
              <p className="text-lg text-slate-600">{t('app.tagline')}</p>
            </div>
            <LanguageSwitcher />
          </div>
          <div className="grid gap-6 md:grid-cols-[2fr,3fr]">
            <TournamentForm />
            <div className="bg-slate-900 text-white rounded-3xl p-6 relative overflow-hidden">
              <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_top,_#4F46E5,_transparent_60%)]" />
              <div className="relative space-y-3">
                <h2 className="text-xl font-semibold">{t('app.cta')}</h2>
                <p className="text-sm text-white/80">
                  Build complex tournament structures with brackets, round robin schedules and advanced analytics from day one.
                  Responsive dashboards scale from desktop control rooms to on-the-go companion apps.
                </p>
                <ul className="text-sm text-white/70 space-y-2">
                  <li>• Configurable points systems and tie-breaker logic</li>
                  <li>• Instant bracket visualisations with drag & drop seeding</li>
                  <li>• Sponsor-ready share links and embeddable widgets</li>
                </ul>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-6 md:grid-cols-[1fr,2fr]">
          <aside className="bg-white rounded-3xl p-6 shadow-md border border-slate-100">
            <h2 className="text-lg font-semibold text-slate-900 mb-3">{t('dashboard.overview')}</h2>
            <TournamentList
              onSelect={(tournament) => setSelectedTournament(tournament)}
              selectedId={selectedTournament?.id}
            />
          </aside>
          <main>
            {selectedTournament ? (
              <TournamentDashboard tournamentId={selectedTournament.id} />
            ) : (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center bg-white rounded-3xl border border-dashed border-slate-200 p-12 text-slate-500">
                <p>{t('dashboard.selectHint')}</p>
              </div>
            )}
          </main>
        </section>
      </div>
    </div>
  )
}

export default App
