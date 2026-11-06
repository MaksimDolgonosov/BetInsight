export function mockOddsPayload(sportKey: string) {
  const profile = mockProfile(sportKey);
  return [
    event(sportKey, "mock-event-1", profile.first.home, profile.first.away, 6, profile.first.point, profile.twoWay, 1.72, 2.14),
    event(sportKey, "mock-event-2", profile.second.home, profile.second.away, 28, profile.second.point, profile.twoWay, 1.55, 2.48),
  ];
}

function mockProfile(sportKey: string) {
  if (sportKey.startsWith("basketball_nba")) {
    return {
      twoWay: true,
      first: { home: "Boston Celtics", away: "Dallas Mavericks", point: 224.5 },
      second: { home: "Denver Nuggets", away: "Milwaukee Bucks", point: 230.5 },
    };
  }
  if (sportKey.startsWith("basketball")) {
    return {
      twoWay: true,
      first: { home: "Real Madrid", away: "Olympiacos", point: 164.5 },
      second: { home: "Fenerbahce", away: "Panathinaikos", point: 158.5 },
    };
  }
  if (sportKey.startsWith("tennis")) {
    return {
      twoWay: true,
      first: { home: "Jannik Sinner", away: "Carlos Alcaraz", point: 22.5 },
      second: { home: "Novak Djokovic", away: "Alexander Zverev", point: 21.5 },
    };
  }
  return {
    twoWay: false,
    first: { home: "Barcelona", away: "Real Madrid", point: 2.5 },
    second: { home: "Bayern Munich", away: "Dortmund", point: 3.5 },
  };
}

function event(
  sportKey: string,
  id: string,
  home: string,
  away: string,
  hoursAhead: number,
  point: number,
  twoWay: boolean,
  homePrice: number,
  awayPrice: number,
) {
  return {
    id,
    sport_key: sportKey,
    commence_time: new Date(Date.now() + hoursAhead * 60 * 60 * 1000).toISOString(),
    home_team: home,
    away_team: away,
    bookmakers: [
      bookmaker("pinnacle", "Pinnacle", home, away, twoWay, homePrice, awayPrice, point),
      bookmaker("bet365", "Bet365", home, away, twoWay, homePrice - 0.02, awayPrice + 0.02, point),
      bookmaker("unibet", "Unibet", home, away, twoWay, homePrice + 0.02, awayPrice - 0.04, point),
    ],
  };
}

function bookmaker(
  key: string,
  title: string,
  home: string,
  away: string,
  twoWay: boolean,
  homePrice: number,
  awayPrice: number,
  point: number,
) {
  const h2h = twoWay
    ? [
        { name: home, price: homePrice },
        { name: away, price: awayPrice },
      ]
    : [
        { name: home, price: homePrice },
        { name: "Draw", price: 3.6 },
        { name: away, price: awayPrice },
      ];

  return {
    key,
    title,
    markets: [
      { key: "h2h", outcomes: h2h },
      {
        key: "totals",
        outcomes: [
          { name: "Over", price: 1.9, point },
          { name: "Under", price: 1.9, point },
        ],
      },
    ],
  };
}
