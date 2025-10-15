import { FormEvent, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createTournament } from '../api/tournaments'
import { useTranslation } from 'react-i18next'

export function TournamentForm () {
  const queryClient = useQueryClient()
  const { t, i18n } = useTranslation()
  const [teamName, setTeamName] = useState('')
  const [teams, setTeams] = useState<string[]>([])

  const mutation = useMutation({
    mutationFn: createTournament,
    onSuccess: async () => {
      setTeams([])
      setTeamName('')
      await queryClient.invalidateQueries({ queryKey: ['tournaments'] })
    }
  })

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    mutation.mutate({
      name: formData.get('name') as string,
      description: (formData.get('description') as string) ?? '',
      locale: formData.get('locale') as string,
      format: formData.get('format') as string,
      teams
    })
    event.currentTarget.reset()
  }

  const addTeam = () => {
    if (!teamName.trim()) return
    setTeams((prev) => [...prev, teamName.trim()])
    setTeamName('')
  }

  return (
    <form onSubmit={onSubmit} className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100">
      <div className="grid gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="name">
            {t('tournamentForm.name')}
          </label>
          <input id="name" name="name" required className="mt-1 w-full rounded-xl border-slate-200 focus:border-primary focus:ring-primary" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="description">
            {t('tournamentForm.description')}
          </label>
          <textarea id="description" name="description" rows={3} className="mt-1 w-full rounded-xl border-slate-200 focus:border-primary focus:ring-primary" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="format">
              {t('tournamentForm.format')}
            </label>
            <select id="format" name="format" className="mt-1 w-full rounded-xl border-slate-200 focus:border-primary focus:ring-primary">
              <option value="round-robin">{t('formats.roundRobin')}</option>
              <option value="knockout">{t('formats.knockout')}</option>
              <option value="swiss" disabled>{t('formats.swiss')}</option>
              <option value="custom" disabled>{t('formats.custom')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="locale">
              {t('tournamentForm.locale')}
            </label>
            <select id="locale" name="locale" defaultValue={i18n.language.split('-')[0]} className="mt-1 w-full rounded-xl border-slate-200 focus:border-primary focus:ring-primary">
              <option value="en">English</option>
              <option value="de">Deutsch</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">{t('tournamentForm.addTeam')}</label>
          <div className="mt-1 flex gap-2">
            <input
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
              placeholder={t('tournamentForm.teamPlaceholder')}
              className="w-full rounded-xl border-slate-200 focus:border-primary focus:ring-primary"
            />
            <button type="button" onClick={addTeam} className="px-3 py-2 rounded-xl bg-secondary text-white font-semibold">
              +
            </button>
          </div>
          {teams.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {teams.map((team, index) => (
                <li key={index} className="px-3 py-1 bg-slate-100 rounded-full text-sm">
                  {team}
                </li>
              ))}
            </ul>
          )}
        </div>
        <button type="submit" className="mt-2 inline-flex justify-center items-center px-4 py-2 bg-primary text-white font-semibold rounded-xl shadow hover:bg-primary/90">
          {mutation.isPending ? '…' : t('tournamentForm.create')}
        </button>
      </div>
    </form>
  )
}
