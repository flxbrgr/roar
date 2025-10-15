import express from 'express'
import cors from 'cors'
import {
  createTournament,
  listTournaments,
  getTournament,
  addTeam,
  updateTournament
} from './tournamentStore.js'
import {
  generateRoundRobinMatches,
  generateKnockoutTree,
  calculateStandings,
  recordMatchResult,
  updateTournamentMatches
} from './tournamentService.js'

const app = express()
app.use(cors())
app.use(express.json())

const PORT = process.env.PORT || 4000

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Tournament service running' })
})

app.get('/api/tournaments', (req, res) => {
  res.json(listTournaments())
})

app.post('/api/tournaments', (req, res) => {
  const { name, locale, format, description, teams = [] } = req.body
  if (!name) {
    return res.status(400).json({ error: 'Name is required' })
  }
  const tournament = createTournament({ name, locale, format, description, teams })
  res.status(201).json(tournament)
})

app.get('/api/tournaments/:id', (req, res) => {
  const tournament = getTournament(req.params.id)
  if (!tournament) return res.status(404).json({ error: 'Not found' })
  const standings = calculateStandings(
    tournament.matches,
    tournament.teams,
    tournament.settings
  )
  res.json({ ...tournament, standings })
})

app.post('/api/tournaments/:id/teams', (req, res) => {
  const { name } = req.body
  if (!name) return res.status(400).json({ error: 'Team name required' })
  const team = addTeam(req.params.id, name)
  if (!team) return res.status(404).json({ error: 'Not found' })
  res.status(201).json(team)
})

app.post('/api/tournaments/:id/schedule/round-robin', (req, res) => {
  const tournament = getTournament(req.params.id)
  if (!tournament) return res.status(404).json({ error: 'Not found' })
  const schedule = updateTournamentMatches(tournament, generateRoundRobinMatches)
  res.json(schedule)
})

app.post('/api/tournaments/:id/schedule/knockout', (req, res) => {
  const tournament = getTournament(req.params.id)
  if (!tournament) return res.status(404).json({ error: 'Not found' })
  const bracket = updateTournamentMatches(tournament, generateKnockoutTree)
  res.json(bracket)
})

app.post('/api/tournaments/:id/matches/:matchId/result', (req, res) => {
  const tournament = getTournament(req.params.id)
  if (!tournament) return res.status(404).json({ error: 'Not found' })
  const { homeScore, awayScore } = req.body
  if (Number.isNaN(Number(homeScore)) || Number.isNaN(Number(awayScore))) {
    return res.status(400).json({ error: 'Scores must be numbers' })
  }
  const result = recordMatchResult(tournament, req.params.matchId, {
    homeScore: Number(homeScore),
    awayScore: Number(awayScore)
  })
  if (!result) return res.status(404).json({ error: 'Match not found' })
  res.json(result)
})

app.put('/api/tournaments/:id/settings', (req, res) => {
  const tournament = getTournament(req.params.id)
  if (!tournament) return res.status(404).json({ error: 'Not found' })
  const { pointsForWin, pointsForDraw, pointsForLoss } = req.body
  tournament.settings = {
    pointsForWin: Number(pointsForWin) || tournament.settings.pointsForWin,
    pointsForDraw: Number(pointsForDraw) || tournament.settings.pointsForDraw,
    pointsForLoss: Number(pointsForLoss) || tournament.settings.pointsForLoss
  }
  updateTournament(tournament.id, tournament)
  res.json(tournament.settings)
})

app.listen(PORT, () => {
  console.log(`Tournament server listening on port ${PORT}`)
})
