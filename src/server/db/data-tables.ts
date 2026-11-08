import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const oddsSnapshots = pgTable(
  "odds_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: text("event_id").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
    bookmaker: text("bookmaker").notNull(),
    market: text("market").notNull(),
    outcome: text("outcome").notNull(),
    point: doublePrecision("point"),
    price: doublePrecision("price").notNull(),
    isClosing: boolean("is_closing").notNull().default(false),
  },
  (table) => [index("odds_snapshots_event_idx").on(table.eventId)],
);

export const apiPayloads = pgTable(
  "api_payloads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    endpoint: text("endpoint").notNull(),
    sportKey: text("sport_key"),
    day: text("day"),
    purpose: text("purpose"),
    cost: integer("cost").notNull().default(0),
    remaining: integer("remaining"),
    used: integer("used"),
    body: jsonb("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("api_payloads_created_at_idx").on(table.createdAt),
    uniqueIndex("api_payloads_call_idx").on(table.endpoint, table.sportKey, table.day, table.purpose),
  ],
);
