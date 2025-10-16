import { upsertMatches } from './tournamentStore.js'

export function generateRoundRobinMatches (teams) {
  if (teams.length < 2) return []

  const roundTeams = teams.length % 2 === 0 ? [...teams] : [...teams, { id: 'bye', name: 'BYE' }]
  const rounds = roundTeams.length - 1
  const half = roundTeams.length / 2
  const schedule = []

  let rotating = [...roundTeams]

  for (let round = 0; round < rounds; round++) {
    const pairings = []
    for (let i = 0; i < half; i++) {
      const home = rotating[i]
      const away = rotating[rotating.length - 1 - i]
      if (home.id !== 'bye' && away.id !== 'bye') {
        pairings.push({
          id: `${round + 1}-${home.id}-${away.id}`,
          round: round + 1,
          homeTeam: home,
          awayTeam: away,
          status: 'scheduled'
        })
      }
    }
    schedule.push({
      round: round + 1,
      matches: pairings
    })

    const fixed = rotating[0]
    const rest = rotating.slice(1)
    const moved = rest.pop()
    if (moved) {
      rest.unshift(moved)
    }
    rotating = [fixed, ...rest]
  }

  return schedule
}

export function calculateStandings (matches, teams, settings) {
  const table = teams.map((team) => ({
    team,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0
  }))

  const tableIndex = new Map(table.map((entry, idx) => [entry.team.id, idx]))

  matches.flatMap((round) => round.matches).forEach((match) => {
    if (match.status !== 'completed') return
    const home = table[tableIndex.get(match.homeTeam.id)]
    const away = table[tableIndex.get(match.awayTeam.id)]

    home.played += 1
    away.played += 1
    home.goalsFor += match.homeScore
    home.goalsAgainst += match.awayScore
    away.goalsFor += match.awayScore
    away.goalsAgainst += match.homeScore

    if (match.homeScore > match.awayScore) {
      home.wins += 1
      away.losses += 1
      home.points += settings.pointsForWin
      away.points += settings.pointsForLoss
    } else if (match.homeScore < match.awayScore) {
      away.wins += 1
      home.losses += 1
      away.points += settings.pointsForWin
      home.points += settings.pointsForLoss
    } else {
      home.draws += 1
      away.draws += 1
      home.points += settings.pointsForDraw
      away.points += settings.pointsForDraw
    }
  })

  table.forEach((entry) => {
    entry.goalDifference = entry.goalsFor - entry.goalsAgainst
  })

  return table.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor
    return a.team.name.localeCompare(b.team.name)
  })
}

export function generateKnockoutTree (teams) {
  if (teams.length < 2) return []
  const orderedTeams = [...teams]
  if ((orderedTeams.length & (orderedTeams.length - 1)) !== 0) {
    // pad to next power of two with BYE nodes
    let power = 1
    while (power < orderedTeams.length) power *= 2
    while (orderedTeams.length < power) {
      orderedTeams.push({ id: `bye-${orderedTeams.length}`, name: 'BYE' })
    }
  }

  const totalRounds = Math.log2(orderedTeams.length)
  const rounds = []
  let previousRound = []

  for (let roundIndex = 0; roundIndex < totalRounds; roundIndex++) {
    const roundMatches = []

    if (roundIndex === 0) {
      for (let i = 0; i < orderedTeams.length; i += 2) {
        const home = orderedTeams[i]
        const away = orderedTeams[i + 1]
        const matchId = `ko-${roundIndex + 1}-${home.id}-${away.id}`
        const match = {
          id: matchId,
          round: roundIndex + 1,
          homeTeam: home,
          awayTeam: away,
          status: home.name === 'BYE' || away.name === 'BYE' ? 'completed' : 'scheduled',
          meta: { stage: `Round ${roundIndex + 1}`, homeFrom: null, awayFrom: null }
        }
        if (home.name === 'BYE' && away.name !== 'BYE') {
          match.winner = away
        } else if (away.name === 'BYE' && home.name !== 'BYE') {
          match.winner = home
        }
        roundMatches.push(match)
      }
    } else {
      for (let i = 0; i < previousRound.length; i += 2) {
        const homeSource = previousRound[i]
        const awaySource = previousRound[i + 1]
        const matchId = `ko-${roundIndex + 1}-${homeSource.id}-${awaySource.id}`
        const match = {
          id: matchId,
          round: roundIndex + 1,
          homeTeam: homeSource.winner ?? { id: `${homeSource.id}-winner`, name: `Winner ${homeSource.id}` },
          awayTeam: awaySource.winner ?? { id: `${awaySource.id}-winner`, name: `Winner ${awaySource.id}` },
          status: 'scheduled',
          meta: { stage: `Round ${roundIndex + 1}`, homeFrom: homeSource.id, awayFrom: awaySource.id }
        }
        roundMatches.push(match)
      }
    }

    rounds.push({ round: roundIndex + 1, matches: roundMatches })
    previousRound = roundMatches
  }

  propagateWinners(rounds)
  return rounds
}

export function recordMatchResult (tournament, matchId, { homeScore, awayScore }) {
  const match = tournament.matches.flatMap((round) => round.matches).find((m) => m.id === matchId)
  if (!match) return null
  match.homeScore = homeScore
  match.awayScore = awayScore
  match.status = 'completed'
  if (match.meta) {
    if (homeScore === awayScore) {
      match.winner = undefined
    } else {
      match.winner = homeScore > awayScore ? match.homeTeam : match.awayTeam
      propagateWinnerToNextRounds(tournament.matches, match)
    }
  }
  tournament.updatedAt = new Date().toISOString()
  return match
}

export function updateTournamentMatches (tournament, generator) {
  const matches = generator(tournament.teams)
  upsertMatches(tournament.id, matches)
  return matches
}

export function reseedKnockoutBracket (tournament, pairings) {
  if (!Array.isArray(pairings)) {
    return { ok: false, error: 'Pairings must be an array' }
  }

  if (!tournament.matches || tournament.matches.length === 0) {
    return { ok: false, error: 'No bracket available for reseeding' }
  }

  const isKnockout = tournament.matches.every((round) =>
    round.matches.every((match) => match.meta && typeof match.meta === 'object')
  )

  if (!isKnockout) {
    return { ok: false, error: 'Only knockout brackets can be reseeded' }
  }

  const hasCompletedMatches = tournament.matches.some((round) =>
    round.matches.some((match) => match.status === 'completed')
  )

  if (hasCompletedMatches) {
    return { ok: false, error: 'Cannot reseed a bracket with recorded results' }
  }

  const teamMap = new Map(tournament.teams.map((team) => [team.id, team]))
  const seen = new Set()
  const orderedTeams = []

  for (const entry of pairings) {
    if (!entry || typeof entry.matchId !== 'string') {
      return { ok: false, error: 'Invalid pairing payload' }
    }

    for (const key of ['homeTeamId', 'awayTeamId']) {
      const teamId = entry[key]
      if (!teamId || teamId.startsWith('bye')) {
        continue
      }

      const team = teamMap.get(teamId)
      if (!team) {
        return { ok: false, error: `Unknown team referenced in pairing: ${teamId}` }
      }

      if (seen.has(teamId)) {
        return { ok: false, error: 'Teams can only appear once in the bracket' }
      }

      orderedTeams.push(team)
      seen.add(teamId)
    }
  }

  if (seen.size !== teamMap.size) {
    return { ok: false, error: 'Each team must be assigned to a slot' }
  }

  if (pairings.length !== Math.ceil(orderedTeams.length / 2)) {
    return { ok: false, error: 'Pairings count does not match tournament size' }
  }

  const matches = generateKnockoutTree(orderedTeams)
  upsertMatches(tournament.id, matches)
  return { ok: true, matches }
}

function propagateWinners (rounds) {
  rounds.forEach((round, index) => {
    if (index === rounds.length - 1) return
    round.matches.forEach((match) => {
      if (!match.winner) return
      const nextRound = rounds[index + 1]
      nextRound.matches.forEach((nextMatch) => {
        if (nextMatch.meta?.homeFrom === match.id) {
          nextMatch.homeTeam = match.winner
        }
        if (nextMatch.meta?.awayFrom === match.id) {
          nextMatch.awayTeam = match.winner
        }
      })
    })
  })
}

function propagateWinnerToNextRounds (rounds, match) {
  rounds.forEach((round) => {
    round.matches.forEach((nextMatch) => {
      if (nextMatch.meta?.homeFrom === match.id) {
        nextMatch.homeTeam = match.winner
      }
      if (nextMatch.meta?.awayFrom === match.id) {
        nextMatch.awayTeam = match.winner
      }
    })
  })
}
