import { useQuery } from '@tanstack/react-query'
import { fetchTournaments, Tournament } from '../api/tournaments'
import { useTranslation } from 'react-i18next'

interface Props {
  onSelect: (tournament: Tournament) => void
  selectedId?: string
}

export function TournamentList ({ onSelect, selectedId }: Props) {
  const { data, isLoading } = useQuery({ queryKey: ['tournaments'], queryFn: fetchTournaments })
  const { t } = useTranslation()

  if (isLoading) {
    return <p className="text-slate-500">Loading…</p>
  }

  if (!data || data.length === 0) {
    return <p className="text-slate-500">{t('dashboard.noTournaments')}</p>
  }

  return (
    <div className="grid gap-3">
      {data.map((tournament) => (
        <button
          key={tournament.id}
          onClick={() => onSelect(tournament)}
          className={`text-left p-4 rounded-2xl border transition-all ${
            tournament.id === selectedId ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-primary'
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">{tournament.name}</h3>
              <p className="text-sm text-slate-600">{tournament.description}</p>
            </div>
            <span className="text-xs font-semibold uppercase tracking-wide text-primary">{tournament.format}</span>
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
            <span>{tournament.teams.length} {t('dashboard.teams')}</span>
            <span>{tournament.matches.reduce((acc, round) => acc + round.matches.length, 0)} {t('dashboard.matches')}</span>
          </div>
        </button>
      ))}
    </div>
  )
}
