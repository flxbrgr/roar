import { useCallback, useEffect, useMemo, useState } from 'react'
import { DndContext, DragOverlay, PointerSensor, closestCenter, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Tournament, Round, Team, BracketPairing, reseedBracket } from '../api/tournaments'
import { useTranslation } from 'react-i18next'

interface Props {
  tournament: Tournament
}

function toPairings (rounds: Round[]): BracketPairing[] {
  if (!rounds[0]) return []
  return rounds[0].matches.map((match) => ({
    matchId: match.id,
    homeTeamId: match.homeTeam?.id,
    awayTeamId: match.awayTeam?.id
  }))
}

interface TeamRowProps {
  matchId: string
  slot: 'home' | 'away'
  team: Team
  score: string
  editable: boolean
  disabled: boolean
}

function TeamRow ({ matchId, slot, team, score, editable, disabled }: TeamRowProps) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `${matchId}:${slot}`,
    data: { matchId, slot },
    disabled: !editable
  })
  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
    id: `${matchId}:${slot}`,
    data: { matchId, slot, teamId: team.id },
    disabled: !editable || disabled
  })

  const setRef = useCallback((node: HTMLElement | null) => {
    setDropRef(node)
    setDragRef(node)
  }, [setDropRef, setDragRef])

  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined
  const highlight = editable ? (isOver ? 'border-primary bg-primary/10' : 'border-slate-200 bg-white hover:border-primary') : 'border-transparent'
  const dragging = isDragging ? 'shadow-lg ring-2 ring-primary/40' : ''

  return (
    <div
      ref={setRef}
      {...attributes}
      {...listeners}
      className={`flex items-center justify-between text-sm font-semibold px-3 py-2 rounded-xl border transition ${highlight} ${editable && !disabled ? 'cursor-move' : ''} ${dragging}`}
      style={style}
    >
      <span>{team.name}</span>
      <span>{score}</span>
    </div>
  )
}

function parseSlot (rawId?: string) {
  if (!rawId) return null
  const [matchId, slot] = rawId.split(':')
  if (slot !== 'home' && slot !== 'away') return null
  return { matchId, slot }
}

export function Bracket ({ tournament }: Props) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const hasMatches = tournament.matches && tournament.matches.length > 0
  if (!hasMatches) return null

  const hasKnockoutMeta = tournament.matches.some((round) => round.matches.some((match) => Boolean(match.meta)))
  if (!hasKnockoutMeta) return null

  const firstRound = tournament.matches[0]
  if (!firstRound) return null

  const [isEditing, setIsEditing] = useState(false)
  const [pairings, setPairings] = useState<BracketPairing[]>(() => toPairings(tournament.matches))
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null)

  useEffect(() => {
    if (!isEditing) {
      setPairings(toPairings(tournament.matches))
    }
  }, [tournament.matches, isEditing])

  const hasCompleted = useMemo(() => (
    tournament.matches.some((round) => round.matches.some((match) => match.status === 'completed'))
  ), [tournament.matches])

  const teamLookup = useMemo(() => {
    const map = new Map<string, Team>()
    tournament.teams.forEach((team) => map.set(team.id, team))
    tournament.matches.forEach((round) => {
      round.matches.forEach((match) => {
        [match.homeTeam, match.awayTeam].forEach((team) => {
          if (team && !map.has(team.id) && team.name === 'BYE') {
            map.set(team.id, team)
          }
        })
      })
    })
    return map
  }, [tournament.matches, tournament.teams])

  const resolveTeam = useCallback((teamId?: string, fallback?: Team) => {
    if (!teamId) return fallback ?? { id: 'bye', name: 'BYE' }
    return teamLookup.get(teamId) ?? fallback ?? { id: teamId, name: 'BYE' }
  }, [teamLookup])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const onDragStart = (event: DragStartEvent) => {
    const teamId = event.active.data.current?.teamId as string | undefined
    if (teamId) {
      setActiveTeamId(teamId)
    }
  }

  const onDragEnd = (event: DragEndEvent) => {
    setActiveTeamId(null)
    const from = parseSlot(event.active.id as string)
    const to = parseSlot(event.over?.id as string)
    if (!from || !to) return
    if (from.matchId === to.matchId && from.slot === to.slot) return

    setPairings((prev) => {
      const next = prev.map((pair) => ({ ...pair }))
      const source = next.find((pair) => pair.matchId === from.matchId)
      const target = next.find((pair) => pair.matchId === to.matchId)
      if (!source || !target) return prev

      const fromKey = from.slot === 'home' ? 'homeTeamId' : 'awayTeamId'
      const toKey = to.slot === 'home' ? 'homeTeamId' : 'awayTeamId'
      const temp = source[fromKey]
      source[fromKey] = target[toKey]
      target[toKey] = temp
      return next
    })
  }

  const pairingsMap = useMemo(() => new Map(pairings.map((pair) => [pair.matchId, pair])), [pairings])

  const displayRounds = useMemo(() => {
    if (!isEditing) return tournament.matches
    const updatedFirst = {
      ...firstRound,
      matches: firstRound.matches.map((match) => {
        const pairing = pairingsMap.get(match.id)
        if (!pairing) return match
        return {
          ...match,
          homeTeam: resolveTeam(pairing.homeTeamId, match.homeTeam),
          awayTeam: resolveTeam(pairing.awayTeamId, match.awayTeam),
          status: 'scheduled',
          homeScore: undefined,
          awayScore: undefined,
          winner: undefined
        }
      })
    }
    return [updatedFirst, ...tournament.matches.slice(1)]
  }, [isEditing, firstRound, pairingsMap, resolveTeam, tournament.matches])

  const activeTeam = activeTeamId ? resolveTeam(activeTeamId) : null

  const mutation = useMutation({
    mutationFn: (payload: BracketPairing[]) => reseedBracket(tournament.id, payload),
    onSuccess: async () => {
      setIsEditing(false)
      setActiveTeamId(null)
      await queryClient.invalidateQueries({ queryKey: ['tournament', tournament.id] })
      await queryClient.invalidateQueries({ queryKey: ['tournaments'] })
    }
  })

  const startEditing = () => {
    setPairings(toPairings(tournament.matches))
    setIsEditing(true)
  }

  const cancelEditing = () => {
    setPairings(toPairings(tournament.matches))
    setIsEditing(false)
  }

  const saveChanges = () => {
    mutation.mutate(pairings)
  }

  const bracketContent = (
    <div className="overflow-x-auto">
      <div className="flex gap-6 min-w-max">
        {displayRounds.map((round) => (
          <div key={round.round} className="flex-1 min-w-[200px]">
            <h4 className="text-sm font-semibold text-slate-600 uppercase">{t('dashboard.round')} {round.round}</h4>
            <div className="mt-3 flex flex-col gap-6">
              {round.matches.map((match) => {
                const editable = isEditing && round.round === 1
                const homeScore = match.status === 'completed' ? String(match.homeScore ?? '-') : '-'
                const awayScore = match.status === 'completed' ? String(match.awayScore ?? '-') : '-'
                return (
                  <div
                    key={match.id}
                    className={`rounded-2xl border ${match.status === 'completed' ? 'border-primary bg-primary/5' : 'border-slate-200 bg-slate-50'} p-3 shadow-sm`}
                  >
                    <div className="flex flex-col gap-2">
                      <TeamRow
                        matchId={match.id}
                        slot="home"
                        team={match.homeTeam}
                        score={homeScore}
                        editable={editable}
                        disabled={match.homeTeam.name === 'BYE'}
                      />
                      <TeamRow
                        matchId={match.id}
                        slot="away"
                        team={match.awayTeam}
                        score={awayScore}
                        editable={editable}
                        disabled={match.awayTeam.name === 'BYE'}
                      />
                      {match.status === 'completed' && match.winner && (
                        <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                          ✓ {match.winner.name}
                        </span>
                      )}
                      {editable && (
                        <p className="text-[11px] text-slate-500">{t('bracket.dragHint')}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-900">{t('dashboard.bracket')}</h3>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={cancelEditing}
                className="px-3 py-2 text-sm font-semibold rounded-xl text-slate-700 bg-slate-100 hover:bg-slate-200"
                disabled={mutation.isPending}
              >
                {t('bracket.cancel')}
              </button>
              <button
                type="button"
                onClick={saveChanges}
                disabled={mutation.isPending}
                className={`px-4 py-2 text-sm font-semibold rounded-xl text-white ${mutation.isPending ? 'bg-primary/70' : 'bg-primary hover:bg-primary/90'}`}
              >
                {mutation.isPending ? t('bracket.saving') : t('bracket.save')}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={startEditing}
              disabled={hasCompleted || mutation.isPending}
              className={`px-4 py-2 text-sm font-semibold rounded-xl ${hasCompleted ? 'bg-slate-300 text-slate-600 cursor-not-allowed' : 'bg-secondary text-white hover:bg-secondary/90'}`}
            >
              {t('bracket.edit')}
            </button>
          )}
        </div>
      </div>
      {hasCompleted && !isEditing && (
        <p className="mt-2 text-xs text-slate-500">{t('bracket.locked')}</p>
      )}
      {mutation.isError && (
        <p className="mt-2 text-xs text-red-600">{t('bracket.error')}</p>
      )}
      {!hasCompleted && !isEditing && (
        <p className="mt-2 text-xs text-slate-500">{t('bracket.editHint')}</p>
      )}
      {isEditing ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          {bracketContent}
          <DragOverlay>
            {activeTeam ? (
              <div className="px-3 py-1 rounded-full text-sm font-semibold bg-primary text-white shadow-lg">
                {activeTeam.name}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        bracketContent
      )}
    </div>
  )
}
