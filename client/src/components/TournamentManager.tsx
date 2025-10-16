import { useMemo, useState, type DragEvent } from 'react'
import { ArrowRight, ListPlus, RefreshCcw, Trophy, Upload } from 'lucide-react'

type Phase = 'setup' | 'roundRobin' | 'bracket'

type Team = {
  id: string
  name: string
  seed: number
}

type Match = {
  id: string
  stage: 'roundRobin' | 'bracket'
  round: number
  homeTeamId: string
  awayTeamId: string
  homeScore: number | null
  awayScore: number | null
}

type StandingsRow = {
  teamId: string
  played: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number
}

type BracketSlot = {
  id: string
  seed: number
  teamId: string | null
}

const createId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10)

const parseCsvTeams = (text: string) =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

export function TournamentManager () {
  const [phase, setPhase] = useState<Phase>('setup')
  const [teamName, setTeamName] = useState('')
  const [teams, setTeams] = useState<Team[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [bracketSlots, setBracketSlots] = useState<BracketSlot[]>([])
  const [draggedTeamId, setDraggedTeamId] = useState<string | null>(null)

  const roundRobinMatches = useMemo(
    () => matches.filter((match) => match.stage === 'roundRobin'),
    [matches]
  )

  const bracketMatches = useMemo(
    () => matches.filter((match) => match.stage === 'bracket'),
    [matches]
  )

  const standings = useMemo<StandingsRow[]>(() => {
    const table = new Map<string, StandingsRow>()

    teams.forEach((team) => {
      table.set(team.id, {
        teamId: team.id,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0
      })
    })

    roundRobinMatches.forEach((match) => {
      const home = table.get(match.homeTeamId)
      const away = table.get(match.awayTeamId)
      if (!home || !away || match.homeScore === null || match.awayScore === null) return

      home.played += 1
      away.played += 1

      home.goalsFor += match.homeScore
      home.goalsAgainst += match.awayScore
      away.goalsFor += match.awayScore
      away.goalsAgainst += match.homeScore

      home.goalDifference = home.goalsFor - home.goalsAgainst
      away.goalDifference = away.goalsFor - away.goalsAgainst

      if (match.homeScore > match.awayScore) {
        home.wins += 1
        away.losses += 1
        home.points += 3
      } else if (match.homeScore < match.awayScore) {
        away.wins += 1
        home.losses += 1
        away.points += 3
      } else {
        home.draws += 1
        away.draws += 1
        home.points += 1
        away.points += 1
      }
    })

    return Array.from(table.values()).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor
      return a.teamId.localeCompare(b.teamId)
    })
  }, [roundRobinMatches, teams])

  const addTeam = () => {
    const trimmed = teamName.trim()
    if (!trimmed) return

    setTeams((current) => [
      ...current,
      {
        id: createId(),
        name: trimmed,
        seed: current.length + 1
      }
    ])
    setTeamName('')
  }

  const removeTeam = (id: string) => {
    setTeams((current) => current.filter((team) => team.id !== id))
  }

  const handleCsvImport = async (file: File | null) => {
    if (!file) return
    const text = await file.text()
    const parsed = parseCsvTeams(text)
    if (!parsed.length) return

    setTeams((current) => {
      let seed = current.length
      const imported = parsed.map((name) => ({
        id: createId(),
        name,
        seed: ++seed
      }))
      return [...current, ...imported]
    })
  }

  const generateRoundRobin = () => {
    if (teams.length < 2) return

    const created: Match[] = []
    for (let i = 0; i < teams.length; i += 1) {
      for (let j = i + 1; j < teams.length; j += 1) {
        created.push({
          id: createId(),
          stage: 'roundRobin',
          round: i + j,
          homeTeamId: teams[i].id,
          awayTeamId: teams[j].id,
          homeScore: null,
          awayScore: null
        })
      }
    }

    setMatches(created)
    setPhase('roundRobin')
  }

  const updateMatchScore = (matchId: string, homeScore: number | null, awayScore: number | null) => {
    setMatches((current) =>
      current.map((match) =>
        match.id === matchId
          ? {
              ...match,
              homeScore,
              awayScore
            }
          : match
      )
    )
  }

  const resetTournament = () => {
    setPhase('setup')
    setMatches([])
    setBracketSlots([])
  }

  const advanceToBracket = () => {
    if (!standings.length) return

    const sortedTeams = standings
      .map((row) => teams.find((team) => team.id === row.teamId))
      .filter((team): team is Team => Boolean(team))

    if (sortedTeams.length < 2) return

    const slots: BracketSlot[] = sortedTeams.map((team, index) => ({
      id: `slot-${index + 1}`,
      seed: index + 1,
      teamId: team.id
    }))

    const firstRound: Match[] = []
    const lastIndex = sortedTeams.length - 1
    for (let i = 0; i < Math.ceil(sortedTeams.length / 2); i += 1) {
      const top = sortedTeams[i]
      const bottom = sortedTeams[lastIndex - i]
      if (!top || !bottom) break
      firstRound.push({
        id: createId(),
        stage: 'bracket',
        round: 1,
        homeTeamId: top.id,
        awayTeamId: bottom.id,
        homeScore: null,
        awayScore: null
      })
    }

    setBracketSlots(slots)
    setMatches((current) => [
      ...current.filter((match) => match.stage !== 'bracket'),
      ...firstRound
    ])
    setPhase('bracket')
  }

  const handleDragStart = (teamId: string) => (event: DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData('text/plain', teamId)
    setDraggedTeamId(teamId)
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
  }

  const handleDrop = (slotId: string) => (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const draggedId = event.dataTransfer.getData('text/plain') || draggedTeamId
    if (!draggedId) return

    setBracketSlots((current) => {
      const next = [...current]
      const sourceIndex = next.findIndex((slot) => slot.teamId === draggedId)
      const targetIndex = next.findIndex((slot) => slot.id === slotId)
      if (sourceIndex === -1 || targetIndex === -1) return current

      const sourceTeamId = next[sourceIndex].teamId
      const targetTeamId = next[targetIndex].teamId

      next[sourceIndex] = {
        ...next[sourceIndex],
        teamId: targetTeamId
      }
      next[targetIndex] = {
        ...next[targetIndex],
        teamId: sourceTeamId
      }
      return next
    })

    setDraggedTeamId(null)
  }

  const getTeamName = (teamId: string) => teams.find((team) => team.id === teamId)?.name ?? 'TBD'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto px-6 py-12 space-y-10">
        <header className="rounded-3xl border border-slate-800 bg-slate-900/70 p-10 shadow-2xl backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="space-y-3">
              <p className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                <Trophy className="h-4 w-4" /> ArenaFlow Labs
              </p>
              <h1 className="text-4xl font-black text-white tracking-tight">Tournament Manager</h1>
              <p className="text-base text-slate-300 max-w-2xl">
                Build out your teams, simulate round-robin play, and promote the top seeds into a draggable championship bracket—all without leaving the browser.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-2 rounded-2xl bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200">
                {phase === 'setup' && 'Setup'}
                {phase === 'roundRobin' && 'Round Robin'}
                {phase === 'bracket' && 'Bracket Finals'}
                <ArrowRight className="h-4 w-4" />
              </span>
              <button
                type="button"
                onClick={resetTournament}
                className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:text-white"
              >
                <RefreshCcw className="h-4 w-4" /> Reset
              </button>
            </div>
          </div>
        </header>

        {phase === 'setup' && (
          <section className="grid gap-8 md:grid-cols-[2fr,3fr]">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-8 space-y-6">
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-white">Add Teams</h2>
                <p className="text-sm text-slate-400">
                  Type team names individually or import a CSV list to seed the tournament automatically.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <input
                    value={teamName}
                    onChange={(event) => setTeamName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        addTeam()
                      }
                    }}
                    type="text"
                    placeholder="Team name"
                    className="flex-1 rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <button
                    type="button"
                    onClick={addTeam}
                    className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary/40 transition hover:shadow-primary/60"
                  >
                    <ListPlus className="h-4 w-4" /> Add
                  </button>
                </div>
                <label className="group relative inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-700 bg-slate-950/30 px-4 py-3 text-sm font-medium text-slate-300 transition hover:border-primary/60 hover:text-white">
                  <Upload className="h-4 w-4" /> Import CSV
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(event) => handleCsvImport(event.target.files?.[0] ?? null)}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                </label>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40">
                <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <span>Seed</span>
                  <span>Team</span>
                  <span>Actions</span>
                </div>
                <ul className="divide-y divide-slate-800">
                  {teams.map((team) => (
                    <li key={team.id} className="flex items-center justify-between px-4 py-3 text-sm text-slate-200">
                      <span className="font-mono text-xs text-slate-500">#{team.seed.toString().padStart(2, '0')}</span>
                      <span className="font-medium">{team.name}</span>
                      <button
                        type="button"
                        onClick={() => removeTeam(team.id)}
                        className="rounded-full px-3 py-1 text-xs font-semibold text-slate-400 transition hover:bg-slate-800 hover:text-white"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                  {!teams.length && (
                    <li className="px-4 py-6 text-center text-sm text-slate-500">No teams added yet.</li>
                  )}
                </ul>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-8">
              <div className="flex h-full flex-col items-start justify-between gap-6">
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-white">Round Robin Preview</h2>
                  <p className="text-sm text-slate-400">
                    Once you have at least two teams, generate the round-robin schedule. Scores can be edited live during the next stage.
                  </p>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-300">
                    {teams.length >= 2 ? (
                      <p>{teams.length} teams will produce {teams.length * (teams.length - 1) / 2} matches.</p>
                    ) : (
                      <p>Add at least two teams to unlock scheduling.</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={teams.length < 2}
                  onClick={generateRoundRobin}
                  className="inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/40 transition hover:shadow-primary/60 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:shadow-none"
                >
                  Generate Schedule
                </button>
              </div>
            </div>
          </section>
        )}

        {phase === 'roundRobin' && (
          <section className="grid gap-8 lg:grid-cols-[3fr,2fr]">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-8">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">Round Robin Matches</h2>
                <button
                  type="button"
                  onClick={advanceToBracket}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-primary/40 transition hover:shadow-primary/60"
                >
                  Seed Bracket
                </button>
              </div>
              <ul className="space-y-4">
                {roundRobinMatches.map((match, index) => (
                  <li key={match.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                    <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <span>Match {index + 1}</span>
                      <span>Round {match.round}</span>
                    </div>
                    <div className="mt-3 grid gap-4 md:grid-cols-[1fr,auto,1fr] md:items-center">
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-white">{getTeamName(match.homeTeamId)}</p>
                        <input
                          type="number"
                          min={0}
                          value={match.homeScore ?? ''}
                          onChange={(event) => {
                            const value = event.target.value
                            updateMatchScore(
                              match.id,
                              value === '' ? null : Number.parseInt(value, 10),
                              match.awayScore
                            )
                          }}
                          className="w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                      <div className="text-center text-xs font-semibold uppercase tracking-widest text-slate-500">
                        VS
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-white">{getTeamName(match.awayTeamId)}</p>
                        <input
                          type="number"
                          min={0}
                          value={match.awayScore ?? ''}
                          onChange={(event) => {
                            const value = event.target.value
                            updateMatchScore(
                              match.id,
                              match.homeScore,
                              value === '' ? null : Number.parseInt(value, 10)
                            )
                          }}
                          className="w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              {!roundRobinMatches.length && (
                <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/30 p-8 text-center text-sm text-slate-500">
                  No matches scheduled yet.
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-8">
              <h2 className="text-xl font-semibold text-white">Standings</h2>
              <div className="mt-4 overflow-hidden rounded-2xl border border-slate-800">
                <table className="min-w-full divide-y divide-slate-800 text-sm">
                  <thead className="bg-slate-950/60 text-xs uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-4 py-3 text-left">Team</th>
                      <th className="px-3 py-3 text-center">P</th>
                      <th className="px-3 py-3 text-center">W</th>
                      <th className="px-3 py-3 text-center">D</th>
                      <th className="px-3 py-3 text-center">L</th>
                      <th className="px-3 py-3 text-center">GF</th>
                      <th className="px-3 py-3 text-center">GA</th>
                      <th className="px-3 py-3 text-center">GD</th>
                      <th className="px-3 py-3 text-center">Pts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {standings.map((row) => (
                      <tr key={row.teamId} className="text-slate-200">
                        <td className="px-4 py-3 font-medium">{getTeamName(row.teamId)}</td>
                        <td className="px-3 py-3 text-center font-mono text-xs">{row.played}</td>
                        <td className="px-3 py-3 text-center font-mono text-xs">{row.wins}</td>
                        <td className="px-3 py-3 text-center font-mono text-xs">{row.draws}</td>
                        <td className="px-3 py-3 text-center font-mono text-xs">{row.losses}</td>
                        <td className="px-3 py-3 text-center font-mono text-xs">{row.goalsFor}</td>
                        <td className="px-3 py-3 text-center font-mono text-xs">{row.goalsAgainst}</td>
                        <td className="px-3 py-3 text-center font-mono text-xs">{row.goalDifference}</td>
                        <td className="px-3 py-3 text-center font-mono text-xs font-semibold text-white">{row.points}</td>
                      </tr>
                    ))}
                    {!standings.length && (
                      <tr>
                        <td colSpan={9} className="px-4 py-6 text-center text-sm text-slate-500">
                          Standings will populate as soon as scores are entered.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {phase === 'bracket' && (
          <section className="grid gap-8 lg:grid-cols-[2fr,3fr]">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-8">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-white">Bracket Seeding</h2>
                <p className="mt-2 text-sm text-slate-400">
                  Drag and drop teams to fine-tune the bracket order. Seeds update instantly.
                </p>
              </div>
              <div className="grid gap-3">
                {bracketSlots.map((slot) => (
                  <div
                    key={slot.id}
                    draggable={Boolean(slot.teamId)}
                    onDragStart={slot.teamId ? handleDragStart(slot.teamId) : undefined}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop(slot.id)}
                    className="group flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm transition hover:border-primary/50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 font-semibold text-slate-200">
                        #{slot.seed}
                      </span>
                      <span className="font-medium text-white">
                        {slot.teamId ? getTeamName(slot.teamId) : 'Open Slot'}
                      </span>
                    </div>
                    <span className="text-xs uppercase tracking-widest text-slate-500 group-hover:text-primary">Drag</span>
                  </div>
                ))}
                {!bracketSlots.length && (
                  <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/30 p-8 text-center text-sm text-slate-500">
                    Seedings will appear after completing the round robin.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-8">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">Championship Bracket</h2>
                <p className="text-xs uppercase tracking-widest text-slate-500">Round 1</p>
              </div>
              <ul className="space-y-4">
                {bracketMatches.map((match, index) => (
                  <li key={match.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                    <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <span>Game {index + 1}</span>
                      <span>Seed {index + 1} vs Seed {bracketMatches.length - index}</span>
                    </div>
                    <div className="grid gap-4 md:grid-cols-[1fr,auto,1fr] md:items-center">
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-white">{getTeamName(match.homeTeamId)}</p>
                        <input
                          type="number"
                          min={0}
                          value={match.homeScore ?? ''}
                          onChange={(event) => {
                            const value = event.target.value
                            updateMatchScore(
                              match.id,
                              value === '' ? null : Number.parseInt(value, 10),
                              match.awayScore
                            )
                          }}
                          className="w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                      <div className="text-center text-xs font-semibold uppercase tracking-widest text-slate-500">
                        VS
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-white">{getTeamName(match.awayTeamId)}</p>
                        <input
                          type="number"
                          min={0}
                          value={match.awayScore ?? ''}
                          onChange={(event) => {
                            const value = event.target.value
                            updateMatchScore(
                              match.id,
                              match.homeScore,
                              value === '' ? null : Number.parseInt(value, 10)
                            )
                          }}
                          className="w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                    </div>
                  </li>
                ))}
                {!bracketMatches.length && (
                  <li className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/30 p-8 text-center text-sm text-slate-500">
                    Generate seeds to populate the bracket.
                  </li>
                )}
              </ul>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

export default TournamentManager
