import { describe, it, expect } from 'vitest'
import { generateRoundRobinMatches, calculateStandings, generateKnockoutTree } from '../src/tournamentService.js'

const sampleTeams = [
  { id: 'a', name: 'Alpha' },
  { id: 'b', name: 'Bravo' },
  { id: 'c', name: 'Charlie' },
  { id: 'd', name: 'Delta' }
]

describe('generateRoundRobinMatches', () => {
  it('creates the correct number of rounds', () => {
    const schedule = generateRoundRobinMatches(sampleTeams)
    expect(schedule).toHaveLength(sampleTeams.length - 1)
  })

  it('schedules each team the correct number of times', () => {
    const schedule = generateRoundRobinMatches(sampleTeams)
    const matchCount = schedule.flatMap((round) => round.matches)
    const appearances = new Map()
    matchCount.forEach((match) => {
      appearances.set(match.homeTeam.id, (appearances.get(match.homeTeam.id) ?? 0) + 1)
      appearances.set(match.awayTeam.id, (appearances.get(match.awayTeam.id) ?? 0) + 1)
    })
    sampleTeams.forEach((team) => {
      expect(appearances.get(team.id)).toBe(sampleTeams.length - 1)
    })
  })
})

describe('calculateStandings', () => {
  it('ranks teams by points and goal difference', () => {
    const schedule = generateRoundRobinMatches(sampleTeams)
    schedule[0].matches[0].status = 'completed'
    schedule[0].matches[0].homeScore = 3
    schedule[0].matches[0].awayScore = 1
    schedule[0].matches[1].status = 'completed'
    schedule[0].matches[1].homeScore = 2
    schedule[0].matches[1].awayScore = 2
    const standings = calculateStandings(schedule, sampleTeams, {
      pointsForWin: 3,
      pointsForDraw: 1,
      pointsForLoss: 0
    })
    expect(standings[0].team.name).toBe('Alpha')
    expect(standings[1].team.name).toBe('Bravo')
  })
})

describe('generateKnockoutTree', () => {
  it('pads to the next power of two', () => {
    const bracket = generateKnockoutTree(sampleTeams.slice(0, 3))
    expect(bracket[0].matches).toHaveLength(2)
  })

  it('propagates winners to subsequent rounds', () => {
    const bracket = generateKnockoutTree(sampleTeams)
    expect(bracket[1].matches[0].homeTeam.name).toContain('Winner')
  })
})
