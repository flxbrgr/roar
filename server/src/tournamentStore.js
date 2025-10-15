import { nanoid } from 'nanoid'

const tournaments = new Map()

export function createTournament ({ name, locale = 'en', format = 'round-robin', description = '', teams = [] }) {
  const id = nanoid()
  const tournament = {
    id,
    name,
    locale,
    format,
    description,
    teams: teams.map((team) => ({ id: nanoid(), name: team })),
    matches: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
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

export function addTeam (tournamentId, name) {
  const tournament = tournaments.get(tournamentId)
  if (!tournament) return null
  const team = { id: nanoid(), name }
  tournament.teams.push(team)
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
