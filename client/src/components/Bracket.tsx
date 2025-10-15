import { Tournament } from '../api/tournaments'
import { useTranslation } from 'react-i18next'

interface Props {
  tournament: Tournament
}

export function Bracket ({ tournament }: Props) {
  const { t } = useTranslation()
  if (!tournament.matches || tournament.matches.length === 0) {
    return null
  }

  const isKnockout = tournament.matches.every((round) => round.matches.length <= Math.pow(2, Math.max(0, tournament.matches.length - round.round)))
  if (!isKnockout) return null

  const maxMatches = Math.max(...tournament.matches.map((round) => round.matches.length))

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-md">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">{t('dashboard.bracket')}</h3>
      <div className="overflow-x-auto">
        <div className="flex gap-6 min-w-max">
          {tournament.matches.map((round) => (
            <div key={round.round} className="flex-1 min-w-[180px]">
              <h4 className="text-sm font-semibold text-slate-600 uppercase">{t('dashboard.round')} {round.round}</h4>
              <div className="mt-3 flex flex-col gap-6">
                {round.matches.map((match) => (
                  <div
                    key={match.id}
                    className={`rounded-2xl border ${match.status === 'completed' ? 'border-primary bg-primary/5' : 'border-slate-200 bg-slate-50'} p-3 shadow-sm`}
                    style={{ minHeight: `${200 / Math.max(1, maxMatches)}px` }}
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between text-sm font-semibold">
                        <span>{match.homeTeam.name}</span>
                        <span>{match.status === 'completed' ? match.homeScore : '-'}</span>
                      </div>
                      <div className="flex justify-between text-sm font-semibold">
                        <span>{match.awayTeam.name}</span>
                        <span>{match.status === 'completed' ? match.awayScore : '-'}</span>
                      </div>
                      {match.status === 'completed' && match.winner && (
                        <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                          ✓ {match.winner.name}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
