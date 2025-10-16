import { nanoid } from 'nanoid'

const tournaments = new Map()

export function createTournament ({ name, locale = 'en', format = 'round-robin', description = '', teams = [] }) {
  const id = nanoid()
  const timestamp = new Date().toISOString()
  const teamObjects = teams.map((team) => ({ id: nanoid(), name: team }))
  const defaultGroup = {
    id: `group-${nanoid(6)}`,
    name: 'Unassigned',
    teamIds: teamObjects.map((team) => team.id)
  }

  const tournament = {
    id,
    name,
    locale,
    format,
    description,
    teams: teamObjects,
    groups: [defaultGroup],
    matches: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    settings: {
      pointsForWin: 3,
      pointsForDraw: 1,
      pointsForLoss: 0
    }
  }
  tournaments.set(id, tournament)
  return tournament
}

export function listTournaments () {
  return Array.from(tournaments.values())
}

export function getTournament (id) {
  return tournaments.get(id)
}

export function updateTournament (id, updates) {
  const tournament = tournaments.get(id)
  if (!tournament) return null
  Object.assign(tournament, updates, { updatedAt: new Date().toISOString() })
  return tournament
}

export function updateGroups (id, groups) {
  const tournament = tournaments.get(id)
  if (!tournament) return { ok: false, error: 'Not found' }
  if (!Array.isArray(groups) || groups.length === 0) {
    return { ok: false, error: 'Groups must be a non-empty array' }
  }

  const validTeamIds = new Set(tournament.teams.map((team) => team.id))
  const assigned = new Set()

  const normalized = groups.map((group) => {
    if (!group || typeof group.id !== 'string' || typeof group.name !== 'string') {
      throw new Error('Invalid group payload')
    }

    const uniqueTeamIds = []
    for (const teamId of group.teamIds ?? []) {
      if (!validTeamIds.has(teamId)) continue
      if (assigned.has(teamId)) continue
      uniqueTeamIds.push(teamId)
      assigned.add(teamId)
    }

    return {
      id: group.id,
      name: group.name.trim() || 'Group',
      teamIds: uniqueTeamIds
    }
  })

  if (assigned.size !== validTeamIds.size) {
    return { ok: false, error: 'All teams must be assigned to exactly one group' }
  }

  tournament.groups = normalized
  tournament.updatedAt = new Date().toISOString()
  return { ok: true, groups: tournament.groups }
}

export function addTeam (tournamentId, name) {
  const tournament = tournaments.get(tournamentId)
  if (!tournament) return null
  const team = { id: nanoid(), name }
  tournament.teams.push(team)
  if (!Array.isArray(tournament.groups) || tournament.groups.length === 0) {
    tournament.groups = [{ id: `group-${nanoid(6)}`, name: 'Unassigned', teamIds: [] }]
  }
  tournament.groups[0].teamIds.push(team.id)
  tournament.updatedAt = new Date().toISOString()
  return team
}

export function upsertMatches (tournamentId, matches) {
  const tournament = tournaments.get(tournamentId)
  if (!tournament) return null
  tournament.matches = matches
  tournament.updatedAt = new Date().toISOString()
  return matches
}

export function deleteAll () {
  tournaments.clear()
}
