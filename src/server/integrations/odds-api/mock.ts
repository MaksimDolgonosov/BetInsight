export function mockOddsPayload(sportKey: string) {
  const basketball = sportKey.startsWith("basketball");
  const first = basketball
    ? { home: "Real Madrid", away: "Olympiacos", point: 164.5 }
    : { home: "Barcelona", away: "Real Madrid", point: 2.5 };
  const second = basketball
    ? { home: "Fenerbahce", away: "Panathinaikos", point: 158.5 }
    : { home: "Bayern Munich", away: "Dortmund", point: 3.5 };

  return [
    event(sportKey, "mock-event-1", first.home, first.away, 6, first.point, basketball, 1.72, 2.14),
    event(sportKey, "mock-event-2", second.home, second.away, 28, second.point, basketball, 1.55, 2.48),
  ];
}

function event(
  sportKey: string,
  id: string,
  home: string,
  away: string,
  hoursAhead: number,
  point: number,
  basketball: boolean,
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
      bookmaker("pinnacle", "Pinnacle", home, away, basketball, homePrice, awayPrice, point),
      bookmaker("bet365", "Bet365", home, away, basketball, homePrice - 0.02, awayPrice + 0.02, point),
      bookmaker("unibet", "Unibet", home, away, basketball, homePrice + 0.02, awayPrice - 0.04, point),
    ],
  };
}

function bookmaker(
  key: string,
  title: string,
  home: string,
  away: string,
  basketball: boolean,
  homePrice: number,
  awayPrice: number,
  point: number,
) {
  const h2h = basketball
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
