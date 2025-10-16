import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { DndContext, DragOverlay, PointerSensor, closestCenter, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { Tournament, TournamentGroup, Team, updateGroups } from '../api/tournaments'
import { useTranslation } from 'react-i18next'

interface Props {
  tournament: Tournament
}

interface LocalGroup extends TournamentGroup {
  teams: Team[]
}

function randomId () {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2)
}

function toLocalGroups (tournament: Tournament): LocalGroup[] {
  const teamLookup = new Map(tournament.teams.map((team) => [team.id, team]))
  const groups = (tournament.groups ?? []).map((group) => ({
    ...group,
    teams: group.teamIds.map((teamId) => teamLookup.get(teamId)).filter((team): team is Team => Boolean(team))
  }))

  if (groups.length === 0) {
    return [{
      id: `group-${randomId()}`,
      name: 'Unassigned',
      teamIds: tournament.teams.map((team) => team.id),
      teams: [...tournament.teams]
    }]
  }

  const clone = [...groups]
  const unassignedIndex = clone.findIndex((group) => group.name.toLowerCase() === 'unassigned')
  if (unassignedIndex === -1) {
    return clone
  }

  const [unassigned] = clone.splice(unassignedIndex, 1)
  return [unassigned, ...clone]
}

function TeamChip ({ team, groupId }: { team: Team, groupId: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: team.id,
    data: { teamId: team.id, groupId }
  })

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`px-3 py-1 rounded-full text-sm font-medium bg-slate-100 text-slate-700 border border-slate-200 cursor-move select-none transition ${isDragging ? 'opacity-70 shadow-lg' : ''}`}
      style={style}
    >
      {team.name}
    </div>
  )
}

function GroupColumn ({
  group,
  isLocked,
  onNameChange,
  onRemove,
  translate
}: {
  group: LocalGroup
  isLocked: boolean
  onNameChange: (groupId: string, name: string) => void
  onRemove: (groupId: string) => void
  translate: (key: string) => string
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: group.id,
    data: { groupId: group.id }
  })

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col gap-3 rounded-2xl border border-dashed ${isOver ? 'border-primary bg-primary/10' : 'border-slate-200 bg-slate-50'} p-4 min-h-[200px] transition`}
    >
      <div className="flex items-center gap-2">
        <input
          className={`text-sm font-semibold flex-1 rounded-lg border ${isLocked ? 'border-transparent bg-transparent text-slate-600' : 'border-slate-200 bg-white px-2 py-1'}`}
          value={isLocked ? translate('groups.unassigned') : group.name}
          onChange={(event) => onNameChange(group.id, event.target.value)}
          disabled={isLocked}
          aria-label={translate('groups.rename')}
        />
        {!isLocked && (
          <button
            type="button"
            onClick={() => onRemove(group.id)}
            className="text-xs font-semibold text-slate-500 hover:text-red-500"
            >
            ×
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {group.teams.map((team) => (
          <TeamChip key={team.id} team={team} groupId={group.id} />
        ))}
        {group.teams.length === 0 && (
          <span className="text-xs text-slate-400">–</span>
        )}
      </div>
    </div>
  )
}

export function GroupManager ({ tournament }: Props) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [groups, setGroups] = useState<LocalGroup[]>(() => toLocalGroups(tournament))
  const [activeTeam, setActiveTeam] = useState<Team | null>(null)
  const [isDirty, setIsDirty] = useState(false)

  useEffect(() => {
    setGroups(toLocalGroups(tournament))
    setIsDirty(false)
  }, [tournament.id, JSON.stringify(tournament.groups), JSON.stringify(tournament.teams)])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const mutation = useMutation({
    mutationFn: (payload: TournamentGroup[]) => updateGroups(tournament.id, payload),
    onSuccess: async () => {
      setIsDirty(false)
      await queryClient.invalidateQueries({ queryKey: ['tournament', tournament.id] })
      await queryClient.invalidateQueries({ queryKey: ['tournaments'] })
    }
  })

  const unassignedGroupId = groups[0]?.id

  const onDragStart = (event: DragStartEvent) => {
    const teamId = event.active.data.current?.teamId as string | undefined
    if (!teamId) return
    const originGroupId = event.active.data.current?.groupId as string | undefined
    const originGroup = groups.find((group) => group.id === originGroupId)
    const team = originGroup?.teams.find((item) => item.id === teamId) ?? null
    setActiveTeam(team)
  }

  const onDragEnd = (event: DragEndEvent) => {
    setActiveTeam(null)
    const teamId = event.active.data.current?.teamId as string | undefined
    const fromGroupId = event.active.data.current?.groupId as string | undefined
    const toGroupId = event.over?.data.current?.groupId as string | undefined

    if (!teamId || !fromGroupId || !toGroupId || fromGroupId === toGroupId) return

    setGroups((prev) => {
      const next = prev.map((group) => ({ ...group, teams: [...group.teams] }))
      const sourceGroup = next.find((group) => group.id === fromGroupId)
      const targetGroup = next.find((group) => group.id === toGroupId)
      if (!sourceGroup || !targetGroup) return prev

      const teamIndex = sourceGroup.teams.findIndex((team) => team.id === teamId)
      if (teamIndex === -1) return prev

      const [team] = sourceGroup.teams.splice(teamIndex, 1)
      targetGroup.teams.push(team)
      setIsDirty(true)
      return next
    })
  }

  const addGroup = () => {
    const existingNames = new Set(groups.map((group) => group.name))
    let suffix = groups.length + 1
    while (existingNames.has(`${t('groups.group')} ${suffix}`)) {
      suffix += 1
    }
    setGroups((prev) => [
      ...prev,
      {
        id: `group-${randomId()}`,
        name: `${t('groups.group')} ${suffix}`,
        teamIds: [],
        teams: []
      }
    ])
    setIsDirty(true)
  }

  const removeGroup = (groupId: string) => {
    if (!unassignedGroupId || groupId === unassignedGroupId) return
    setGroups((prev) => {
      const target = prev.find((group) => group.id === groupId)
      const remaining = prev.filter((group) => group.id !== groupId)
      const updated = remaining.map((group) => {
        if (group.id !== unassignedGroupId || !target) return { ...group, teams: [...group.teams] }
        return { ...group, teams: [...group.teams, ...target.teams] }
      })
      setIsDirty(true)
      return updated
    })
  }

  const updateName = (groupId: string, name: string) => {
    setGroups((prev) => prev.map((group) => (group.id === groupId ? { ...group, name } : group)))
    setIsDirty(true)
  }

  const saveGroups = () => {
    const payload = groups.map((group) => ({
      id: group.id,
      name: group.name.trim() || t('groups.group'),
      teamIds: group.teams.map((team) => team.id)
    }))
    mutation.mutate(payload)
  }

  const layoutGroups = useMemo(() => groups, [groups])

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{t('groups.title')}</h3>
          <p className="text-sm text-slate-500">{t('groups.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={addGroup}
            className="px-3 py-2 rounded-xl bg-slate-100 text-sm font-semibold text-slate-700 hover:bg-slate-200"
          >
            {t('groups.addGroup')}
          </button>
          <button
            type="button"
            onClick={saveGroups}
            disabled={!isDirty || mutation.isPending}
            className={`px-4 py-2 rounded-xl text-sm font-semibold text-white ${!isDirty ? 'bg-slate-300 cursor-not-allowed' : 'bg-primary hover:bg-primary/90'} ${mutation.isPending ? 'opacity-80' : ''}`}
          >
            {mutation.isPending ? t('groups.saving') : t('groups.save')}
          </button>
        </div>
      </div>
      {isDirty && !mutation.isPending && (
        <p className="mt-2 text-xs text-amber-600 font-medium">{t('groups.unsaved')}</p>
      )}
      {mutation.isError && (
        <p className="mt-2 text-xs text-red-600 font-medium">{t('groups.error')}</p>
      )}
      {mutation.isSuccess && !isDirty && (
        <p className="mt-2 text-xs text-emerald-600 font-medium">{t('groups.saved')}</p>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {layoutGroups.map((group, index) => (
            <GroupColumn
              key={group.id}
              group={group}
              isLocked={index === 0}
              onNameChange={updateName}
              onRemove={removeGroup}
              translate={t}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTeam ? (
            <div className="px-3 py-1 rounded-full text-sm font-medium bg-primary text-white shadow-lg">
              {activeTeam.name}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
