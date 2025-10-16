import { useQuery } from '@tanstack/react-query'
import { fetchTournament, Tournament } from '../api/tournaments'
import { MatchList } from './MatchList'
import { StandingsTable } from './StandingsTable'
import { Bracket } from './Bracket'
import { GroupManager } from './GroupManager'
import { useTranslation } from 'react-i18next'

interface Props {
  tournamentId: string
}

export function TournamentDashboard ({ tournamentId }: Props) {
  const { t } = useTranslation()
  const { data, isLoading } = useQuery({
    queryKey: ['tournament', tournamentId],
    queryFn: () => fetchTournament(tournamentId),
    enabled: Boolean(tournamentId)
  })

  if (isLoading || !data) {
    return <p className="text-slate-500">Loading…</p>
  }

  return (
    <div className="space-y-6">
      <header className="bg-gradient-to-r from-primary to-secondary text-white rounded-3xl p-6 shadow-lg">
        <h2 className="text-2xl font-bold">{data.name}</h2>
        <p className="text-sm text-white/80 max-w-2xl">{data.description}</p>
        <div className="mt-4 flex flex-wrap gap-4 text-xs uppercase tracking-wide">
          <span className="bg-white/20 px-3 py-1 rounded-full">{t('dashboard.teams')}: {data.teams.length}</span>
          <span className="bg-white/20 px-3 py-1 rounded-full">{t('dashboard.matches')}: {data.matches.reduce((acc, round) => acc + round.matches.length, 0)}</span>
          <span className="bg-white/20 px-3 py-1 rounded-full">{t('tournamentForm.format')}: {data.format}</span>
        </div>
      </header>
      <GroupManager tournament={data as Tournament} />
      <MatchList tournament={data as Tournament} />
      <Bracket tournament={data as Tournament} />
      <StandingsTable tournament={data as Tournament} />
    </div>
  )
}
