import axios from 'axios'

export interface Team {
  id: string
  name: string
}

export interface Match {
  id: string
  round: number
  homeTeam: Team
  awayTeam: Team
  status: 'scheduled' | 'completed'
  homeScore?: number
  awayScore?: number
  winner?: Team
}

export interface Round {
  round: number
  matches: Match[]
}

export interface Tournament {
  id: string
  name: string
  description: string
  locale: string
  format: string
  teams: Team[]
  groups: TournamentGroup[]
  matches: Round[]
  settings: {
    pointsForWin: number
    pointsForDraw: number
    pointsForLoss: number
  }
  standings?: Array<{
    team: Team
    played: number
    wins: number
    draws: number
    losses: number
    goalsFor: number
    goalsAgainst: number
    goalDifference: number
    points: number
  }>
}

export interface TournamentGroup {
  id: string
  name: string
  teamIds: string[]
}

export interface BracketPairing {
  matchId: string
  homeTeamId?: string
  awayTeamId?: string
}

const api = axios.create({
  baseURL: '/api'
})

export async function fetchTournaments () {
  const { data } = await api.get<Tournament[]>('/tournaments')
  return data
}

export async function createTournament (payload: {
  name: string
  description: string
  locale: string
  format: string
  teams: string[]
}) {
  const { data } = await api.post<Tournament>('/tournaments', payload)
  return data
}

export async function fetchTournament (id: string) {
  const { data } = await api.get<Tournament>(`/tournaments/${id}`)
  return data
}

export async function generateSchedule (id: string, mode: 'round-robin' | 'knockout') {
  const endpoint = mode === 'round-robin' ? 'round-robin' : 'knockout'
  const { data } = await api.post<Round[]>(`/tournaments/${id}/schedule/${endpoint}`)
  return data
}

export async function recordResult (tournamentId: string, matchId: string, payload: { homeScore: number, awayScore: number }) {
  const { data } = await api.post(`/tournaments/${tournamentId}/matches/${matchId}/result`, payload)
  return data
}

export async function updateGroups (tournamentId: string, groups: TournamentGroup[]) {
  const { data } = await api.put<TournamentGroup[]>(`/tournaments/${tournamentId}/groups`, { groups })
  return data
}

export async function reseedBracket (tournamentId: string, pairings: BracketPairing[]) {
  const { data } = await api.put<Round[]>(`/tournaments/${tournamentId}/bracket`, { pairings })
  return data
}
