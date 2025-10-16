import type { FormEvent, KeyboardEvent } from 'react'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createTournament } from '../api/tournaments'
import { useTranslation } from 'react-i18next'

export function TournamentForm (): JSX.Element {
  const queryClient = useQueryClient()
  const { t, i18n } = useTranslation()
  const [teamName, setTeamName] = useState('')
  const [teams, setTeams] = useState<string[]>([])
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null)

  const mutation = useMutation({
    mutationFn: createTournament,
    onSuccess: async () => {
      setTeams([])
      setTeamName('')
      await queryClient.invalidateQueries({ queryKey: ['tournaments'] })
      setFeedback({ type: 'success', message: t('notifications.created') })
    },
    onError: (error: unknown) => {
      const apiError = error as { response?: { data?: { error?: string } } }
      const message = typeof apiError?.response?.data?.error === 'string'
        ? apiError.response.data.error
        : t('notifications.createError')
      setFeedback({ type: 'error', message })
    }
  })

  const hasMinimumTeams = teams.length >= 2

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!hasMinimumTeams) {
      setFeedback({ type: 'error', message: t('tournamentForm.teamRequirement') })
      return
    }
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
    const rawEntries = teamName
      .split(/[\n,]+/)
      .map((entry) => entry.trim())
      .filter(Boolean)

    if (rawEntries.length === 0) return

    const existing = new Set(teams.map((team) => team.toLowerCase()))
    const nextTeams = [...teams]
    let duplicateFound = false
    let addedCount = 0

    for (const entry of rawEntries) {
      const lower = entry.toLowerCase()
      if (existing.has(lower)) {
        duplicateFound = true
        continue
      }
      existing.add(lower)
      nextTeams.push(entry)
      addedCount += 1
    }

    if (addedCount > 0) {
      setTeams(nextTeams)
      setTeamName('')
    }

    if (duplicateFound && addedCount === 0) {
      setFeedback({ type: 'error', message: t('tournamentForm.duplicateTeam') })
    } else if (addedCount > 0) {
      setFeedback(null)
    }
  }

  const onTeamInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      addTeam()
    }
  }

  const removeTeam = (index: number) => {
    setTeams((prev) => prev.filter((_, teamIndex) => teamIndex !== index))
    setFeedback(null)
  }

  return (
    <form onSubmit={onSubmit} className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100">
      <div className="grid gap-4">
        {feedback && (
          <div
            className={`text-sm font-medium px-3 py-2 rounded-xl ${feedback.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}
            role="status"
            aria-live="polite"
          >
            {feedback.message}
          </div>
        )}
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
              onKeyDown={onTeamInputKeyDown}
              placeholder={t('tournamentForm.teamPlaceholder')}
              className="w-full rounded-xl border-slate-200 focus:border-primary focus:ring-primary"
            />
            <button type="button" onClick={addTeam} className="px-3 py-2 rounded-xl bg-secondary text-white font-semibold">
              +
            </button>
          </div>
          {!hasMinimumTeams && (
            <p className="mt-1 text-xs text-slate-500">{t('tournamentForm.teamRequirement')}</p>
          )}
          {teams.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {teams.map((team, index) => (
                <li key={team + index} className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full text-sm">
                  <span>{team}</span>
                  <button
                    type="button"
                    onClick={() => removeTeam(index)}
                    className="text-xs text-slate-500 hover:text-red-500"
                    aria-label={t('tournamentForm.removeTeam')}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="submit"
          disabled={mutation.isPending}
          aria-disabled={!hasMinimumTeams || mutation.isPending}
          className={`mt-2 inline-flex justify-center items-center px-4 py-2 rounded-xl font-semibold shadow ${hasMinimumTeams ? 'bg-primary text-white hover:bg-primary/90' : 'bg-slate-200 text-slate-600'} ${mutation.isPending ? 'opacity-80 cursor-wait' : ''}`}
        >
          {mutation.isPending ? '…' : t('tournamentForm.create')}
        </button>
      </div>
    </form>
  )
}
