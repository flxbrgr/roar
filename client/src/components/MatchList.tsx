import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { generateSchedule, recordResult, Tournament } from '../api/tournaments'
import { useTranslation } from 'react-i18next'

interface Props {
  tournament: Tournament
}

export function MatchList ({ tournament }: Props) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<'round-robin' | 'knockout'>('round-robin')
  const [activeMatch, setActiveMatch] = useState<string | null>(null)
  const [scores, setScores] = useState<{ [key: string]: { homeScore: number; awayScore: number } }>({})

  const scheduleMutation = useMutation({
    mutationFn: () => generateSchedule(tournament.id, mode),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tournament', tournament.id] })
    }
  })

  const resultMutation = useMutation({
    mutationFn: ({ matchId, homeScore, awayScore }: { matchId: string, homeScore: number, awayScore: number }) =>
      recordResult(tournament.id, matchId, { homeScore, awayScore }),
    onSuccess: async () => {
      setActiveMatch(null)
      await queryClient.invalidateQueries({ queryKey: ['tournament', tournament.id] })
    }
  })

  const matches = tournament.matches

  const openResultForm = (matchId: string) => {
    setActiveMatch(matchId)
    setScores((prev) => ({ ...prev, [matchId]: prev[matchId] ?? { homeScore: 0, awayScore: 0 } }))
  }

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-900">{t('dashboard.matches')}</h3>
        <div className="flex items-center gap-2">
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value as 'round-robin' | 'knockout')}
            className="rounded-xl border-slate-200"
          >
            <option value="round-robin">{t('formats.roundRobin')}</option>
            <option value="knockout">{t('formats.knockout')}</option>
          </select>
          <button
            onClick={() => scheduleMutation.mutate()}
            className="px-4 py-2 rounded-xl bg-secondary text-white font-semibold hover:bg-secondary/90"
          >
            {scheduleMutation.isPending ? '…' : mode === 'round-robin' ? t('dashboard.generateRoundRobin') : t('dashboard.generateKnockout')}
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {matches.length === 0 && <p className="text-slate-500">{t('dashboard.noMatches')}</p>}
        {matches.map((round) => (
          <div key={round.round} className="border border-slate-200 rounded-2xl p-4">
            <h4 className="font-semibold text-slate-800">{t('dashboard.round')} {round.round}</h4>
            <div className="mt-3 grid gap-3">
              {round.matches.map((match) => (
                <div key={match.id} className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-4">
                    <span className="font-semibold">{match.homeTeam.name}</span>
                    <span className="text-slate-400">vs</span>
                    <span className="font-semibold">{match.awayTeam.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {match.status === 'completed' ? (
                      <span className="font-mono text-sm bg-white px-3 py-1 rounded-lg border border-slate-200">
                        {match.homeScore} : {match.awayScore}
                      </span>
                    ) : activeMatch === match.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          className="w-16 rounded-lg border-slate-200"
                          value={scores[match.id]?.homeScore ?? 0}
                          onChange={(event) =>
                            setScores((prev) => ({
                              ...prev,
                              [match.id]: {
                                homeScore: Number(event.target.value),
                                awayScore: prev[match.id]?.awayScore ?? 0
                              }
                            }))
                          }
                        />
                        <span>:</span>
                        <input
                          type="number"
                          className="w-16 rounded-lg border-slate-200"
                          value={scores[match.id]?.awayScore ?? 0}
                          onChange={(event) =>
                            setScores((prev) => ({
                              ...prev,
                              [match.id]: {
                                homeScore: prev[match.id]?.homeScore ?? 0,
                                awayScore: Number(event.target.value)
                              }
                            }))
                          }
                        />
                        <button
                          onClick={() =>
                            resultMutation.mutate({
                              matchId: match.id,
                              homeScore: scores[match.id]?.homeScore ?? 0,
                              awayScore: scores[match.id]?.awayScore ?? 0
                            })
                          }
                          className="px-3 py-1 bg-primary text-white rounded-lg"
                        >
                          {resultMutation.isPending ? '…' : t('dashboard.recordScore')}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => openResultForm(match.id)}
                        className="px-3 py-1 text-sm font-semibold text-primary"
                      >
                        {t('dashboard.recordScore')}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
