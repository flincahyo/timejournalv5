// â”€â”€ Trade Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export type TradeDirection = "BUY" | "SELL" | "BUY LIMIT" | "SELL LIMIT" | "BUY STOP" | "SELL STOP" | "BUY STOP LIMIT" | "SELL STOP LIMIT";
export type TradeStatus = "closed" | "live" | "pending";
export type CloseType = "all" | "target_hit" | "stopped_out" | "manually_closed";

export interface Trade {
  id: string;
  ticket: number;
  symbol: string;
  type: TradeDirection;
  lots: number;
  openTime: string;       // ISO string, UTC from MT5
  openTimeWIB: string;    // converted to WIB (UTC+7)
  closeTime: string;
  closeTimeWIB: string;
  openPrice: number;
  closePrice: number;
  sl: number;
  tp: number;
  pnl: number;
  pips: number;           // profit/loss in pips
  avgPipsPerTrade: number;
  swap: number;
  commission: number;
  rr: number;             // risk:reward ratio
  session: string;
  setup: string;
  emotion: string;
  tags?: string[];
  note?: string;
  status: TradeStatus;
  closeType: CloseType;
  durationMs: number;     // trade duration in ms
  isIntraday: boolean;
  currentPrice?: number;
}

// â”€â”€ Account Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export interface MT5Account {
  login: number;
  name: string;
  server: string;
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  profit: number;         // unrealized PnL from open positions
  currency: string;
  leverage: number;
}

// â”€â”€ Stats Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export interface TradeStats {
  totalPnl: number;
  winRate: number;
  lossRate: number;
  avgRR: number;
  avgPips: number;
  profitFactor: number;
  expectedValue: number;
  avgTradeTimeMs: number;
  totalFees: number;
  totalTrades: number;
  wins: number;
  losses: number;
  breakeven: number;
  longestWinStreak: number;
  longestLossStreak: number;
  avgWin: number;
  avgLoss: number;
  avgPnlPerTrade: number;
  bestTrade: number;
  worstTrade: number;
  bestSymbol: string;
  worstSymbol: string;
  // Long/Short breakdown
  longWins: number;
  longLosses: number;
  longPnl: number;
  longAvgWin: number;
  longAvgLoss: number;
  shortWins: number;
  shortLosses: number;
  shortPnl: number;
  shortAvgWin: number;
  shortAvgLoss: number;
  // Duration
  scalpingWinRate: number;
  intradayWinRate: number;
  multidayWinRate: number;
  avgHoldWins: number;
  avgHoldLosses: number;
  avgHoldLongs: number;
  avgHoldShorts: number;
  totalPips?: number;
  equityCurve?: { d: string; v: number }[];
  // Symbol stats
  numberOfSymbols: number;
  symbolStats: SymbolStat[];
}

export interface SymbolStat {
  symbol: string;
  pnl: number;
  count: number;
  wins: number;
  losses: number;
  winRate: number;
  avgPips: number;
  pips: number;
}

// â”€â”€ Filter Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export interface TradeFilter {
  symbols: string[];
  side: "all" | "buy" | "sell";
  closeType: CloseType;
  setups: string[];
  sessions: string[];
  dateFrom: string | null;
  dateTo: string | null;
  timeFrom: string | null;   // "HH:mm"
  timeTo: string | null;
  minPnl: number | null;
  maxPnl: number | null;
  minRR: number | null;
  maxRR: number | null;
}

export const DEFAULT_FILTER: TradeFilter = {
  symbols: [],
  side: "all",
  closeType: "all",
  setups: [],
  sessions: [],
  dateFrom: null,
  dateTo: null,
  timeFrom: null,
  timeTo: null,
  minPnl: null,
  maxPnl: null,
  minRR: null,
  maxRR: null,
};

// â”€â”€ Auth Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export interface User {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  provider: "google" | "credentials";
  createdAt: string;
}

export interface MT5AccountSession {
  id: number;
  userId: string;
  login: number;
  server: string;
  isActive: boolean;
  lastSync: string | null;
  account: MT5Account | null;
}

// â”€â”€ Theme â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export type Theme = "dark" | "light";
