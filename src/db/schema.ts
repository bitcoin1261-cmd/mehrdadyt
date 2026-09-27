import {
  pgTable,
  serial,
  text,
  timestamp,
  doublePrecision,
  integer,
  boolean,
  jsonb,
  date,
  uniqueIndex,
  index,
  customType,
} from "drizzle-orm/pg-core";

/** باینری خام برای ذخیره تصاویر چارت در دیتابیس */
export const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

/** Trading accounts (MT5 logins / manual books) */
export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  broker: text("broker"),
  login: text("login"),
  currency: text("currency").notNull().default("USD"),
  initialBalance: doublePrecision("initial_balance").notNull().default(0),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Instrument meta data used for pip / risk calculation */
export const symbols = pgTable(
  "symbols",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    digits: integer("digits").notNull().default(5),
    pipSize: doublePrecision("pip_size").notNull().default(0.0001),
    contractSize: doublePrecision("contract_size").notNull().default(100000),
    /** ضریب تبدیل ارز پایانی نماد به ارز حساب (برای سود و ریسک) */
    quoteRate: doublePrecision("quote_rate").notNull().default(1),
    category: text("category").notNull().default("forex"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("symbols_name_uidx").on(t.name)],
);

/** The trade journal itself */
export const trades = pgTable(
  "trades",
  {
    id: serial("id").primaryKey(),
    accountId: integer("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),

    // identification for MT5 positions
    externalId: text("external_id"), // MT5 position id / ticket
    source: text("source").notNull().default("manual"), // manual | mt5

    symbol: text("symbol").notNull(),
    direction: text("direction").notNull().default("buy"), // buy | sell
    volume: doublePrecision("volume").notNull().default(0),
    closedVolume: doublePrecision("closed_volume").notNull().default(0),

    openTime: timestamp("open_time", { withTimezone: true }).notNull(),
    closeTime: timestamp("close_time", { withTimezone: true }),
    openPrice: doublePrecision("open_price"),
    closePrice: doublePrecision("close_price"),
    sl: doublePrecision("sl"),
    tp: doublePrecision("tp"),

    commission: doublePrecision("commission").notNull().default(0),
    swap: doublePrecision("swap").notNull().default(0),
    fee: doublePrecision("fee").notNull().default(0),
    grossProfit: doublePrecision("gross_profit").notNull().default(0),
    netProfit: doublePrecision("net_profit").notNull().default(0),

    pips: doublePrecision("pips"),
    riskAmount: doublePrecision("risk_amount"),
    rMultiple: doublePrecision("r_multiple"),

    status: text("status").notNull().default("open"), // open | closed

    // journal fields
    strategy: text("strategy"),
    setup: text("setup"),
    timeframe: text("timeframe"),
    session: text("session"),
    emotion: text("emotion"),
    rating: integer("rating"),
    followedPlan: boolean("followed_plan"),
    mistake: text("mistake"),
    notes: text("notes"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    screenshotUrl: text("screenshot_url"),
    /** اسکرین‌شات خودکار لحظه باز شدن معامله */
    openShotUrl: text("open_shot_url"),
    /** اسکرین‌شات خودکار لحظه بسته شدن معامله */
    closeShotUrl: text("close_shot_url"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("trades_source_external_uidx").on(t.source, t.externalId),
    index("trades_open_time_idx").on(t.openTime),
    index("trades_symbol_idx").on(t.symbol),
  ],
);

/** Every raw MT5 deal that reached the webhook (deduplication + audit trail) */
export const mtDeals = pgTable(
  "mt_deals",
  {
    id: serial("id").primaryKey(),
    dealTicket: text("deal_ticket").notNull(),
    positionId: text("position_id"),
    accountId: integer("account_id").references(() => accounts.id, { onDelete: "cascade" }),
    accountLogin: text("account_login"),
    symbol: text("symbol"),
    direction: text("direction"),
    volume: doublePrecision("volume"),
    price: doublePrecision("price"),
    profit: doublePrecision("profit"),
    entry: text("entry"),
    eventTime: timestamp("event_time", { withTimezone: true }),
    payload: jsonb("payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("mt_deals_ticket_uidx").on(t.dealTicket)],
);

/** Daily journal notes (psychology, lessons, market context) */
export const journalNotes = pgTable(
  "journal_notes",
  {
    id: serial("id").primaryKey(),
    noteDate: date("note_date").notNull(),
    mood: text("mood"),
    title: text("title"),
    body: text("body"),
    lesson: text("lesson"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("journal_notes_date_uidx").on(t.noteDate)],
);

/** تصاویر چارت که با باز/بسته شدن معامله به‌صورت خودکار گرفته می‌شوند */
export const screenshots = pgTable(
  "screenshots",
  {
    id: serial("id").primaryKey(),
    tradeId: integer("trade_id").references(() => trades.id, { onDelete: "set null" }),
    positionId: text("position_id"),
    dealTicket: text("deal_ticket"),
    /** open | close | manual */
    kind: text("kind").notNull().default("open"),
    symbol: text("symbol"),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull().default("image/png"),
    sizeBytes: integer("size_bytes").notNull().default(0),
    width: integer("width"),
    height: integer("height"),
    data: bytea("data").notNull(),
    source: text("source").notNull().default("mt5"),
    takenAt: timestamp("taken_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("screenshots_dedupe_uidx").on(t.dealTicket, t.kind),
    index("screenshots_trade_idx").on(t.tradeId),
    index("screenshots_position_idx").on(t.positionId),
  ],
);

/** API tokens used by the MetaTrader connector */
export const apiKeys = pgTable(
  "api_keys",
  {
    id: serial("id").primaryKey(),
    token: text("token").notNull(),
    label: text("label").notNull().default("MetaTrader"),
    isActive: boolean("is_active").notNull().default(true),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("api_keys_token_uidx").on(t.token)],
);
