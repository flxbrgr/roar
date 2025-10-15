import { Tournament } from '../api/tournaments'
import { useTranslation } from 'react-i18next'

interface Props {
  tournament: Tournament
}

export function StandingsTable ({ tournament }: Props) {
  const { t } = useTranslation()
  if (!tournament.standings || tournament.standings.length === 0) {
    return null
  }

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-md">
      <h3 className="text-lg font-semibold text-slate-900">{t('dashboard.standings')}</h3>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-slate-500 uppercase tracking-wide">
            <tr>
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">{t('dashboard.teams')}</th>
              <th className="px-3 py-2">{t('tables.played')}</th>
              <th className="px-3 py-2">{t('tables.wins')}</th>
              <th className="px-3 py-2">{t('tables.draws')}</th>
              <th className="px-3 py-2">{t('tables.losses')}</th>
              <th className="px-3 py-2">{t('tables.gf')}</th>
              <th className="px-3 py-2">{t('tables.ga')}</th>
              <th className="px-3 py-2">{t('tables.gd')}</th>
              <th className="px-3 py-2">{t('tables.points')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tournament.standings.map((row, index) => (
              <tr key={row.team.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-semibold text-slate-500">{index + 1}</td>
                <td className="px-3 py-2 font-medium text-slate-800">{row.team.name}</td>
                <td className="px-3 py-2 text-center">{row.played}</td>
                <td className="px-3 py-2 text-center">{row.wins}</td>
                <td className="px-3 py-2 text-center">{row.draws}</td>
                <td className="px-3 py-2 text-center">{row.losses}</td>
                <td className="px-3 py-2 text-center">{row.goalsFor}</td>
                <td className="px-3 py-2 text-center">{row.goalsAgainst}</td>
                <td className="px-3 py-2 text-center">{row.goalDifference}</td>
                <td className="px-3 py-2 text-center font-semibold text-primary">{row.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
