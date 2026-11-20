export function isKnockoutStage(stage) {
  return stage?.type === 'knockout' || stage?.type === 'final';
}

export function knockoutTies(stage, matches) {
  const groups = new Map();
  for (const match of matches) {
    const key = match.seriesId ? 'series:' + match.seriesId : 'match:' + match.id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(match);
  }
  return [...groups.values()].map(games => {
    games.sort((a, b) => (Number(a.leg) || 0) - (Number(b.leg) || 0)
      || String(a.dateValue || '').localeCompare(String(b.dateValue || ''))
      || String(a.time || '').localeCompare(String(b.time || '')));
    const first = games[0];
    const teams = [first.local, first.visitor];
    const twoLegs = stage.matchMode === 'home_away' || Number(stage.legs) === 2
      || games.length > 1 || Number(first.leg) === 2;
    const finished = games.filter(game => String(game.status).toLowerCase() === 'finalizado');
    const complete = Boolean(teams[0] && teams[1] && teams[0] !== teams[1]
      && games.length === (twoLegs ? 2 : 1) && finished.length === games.length
      && (!twoLegs || !games[0].leg || !games[1].leg || Number(games[0].leg) !== Number(games[1].leg))
      && games.every(game => (game.local === teams[0] && game.visitor === teams[1])
        || (game.local === teams[1] && game.visitor === teams[0])));
    const aggregate = [0, 0];
    for (const game of finished) {
      const local = game.local === teams[0] ? 0 : 1;
      aggregate[local] += Number(game.homeScore || 0);
      aggregate[1 - local] += Number(game.awayScore || 0);
    }
    let winner;
    let penalties;
    if (complete && aggregate[0] !== aggregate[1]) {
      winner = teams[aggregate[0] > aggregate[1] ? 0 : 1];
    } else if (complete) {
      const decidingMatch = games.at(-1);
      const { penaltyHome, penaltyAway, qualifiedTeamId } = decidingMatch;
      if (penaltyHome != null && penaltyAway != null && Number(penaltyHome) !== Number(penaltyAway)) {
        const homeWon = Number(penaltyHome) > Number(penaltyAway);
        winner = homeWon ? decidingMatch.local : decidingMatch.visitor;
        penalties = decidingMatch.local === teams[0]
          ? [penaltyHome, penaltyAway] : [penaltyAway, penaltyHome];
      } else if (teams.includes(qualifiedTeamId)) {
        winner = qualifiedTeamId;
      }
    }
    return { games, teams, twoLegs, aggregate, played: finished.length, complete, winner, penalties };
  });
}
