import type { ServerConfig } from "./config";

interface WindowCounter {
  startedAt: number;
  count: number;
}

export class UsageLimitError extends Error {
  constructor() {
    super(
      "Semantic review is temporarily unavailable because the public demo usage limit has been reached. Your workflow was not sent to SERV. Try again later.",
    );
    this.name = "UsageLimitError";
  }
}

export class UsageGuard {
  private readonly sessions = new Map<string, WindowCounter>();
  private readonly ips = new Map<string, WindowCounter>();
  private day = utcDay(Date.now());
  private dailyRequests = 0;
  private reservedSpend = 0;

  constructor(
    private readonly config: ServerConfig,
    private readonly now: () => number = Date.now,
  ) {}

  reserve(sessionId: string, ip: string): void {
    const now = this.now();
    this.rollDay(now);
    const session = this.currentCounter(this.sessions, sessionId, now);
    const sourceIp = this.currentCounter(this.ips, ip, now);
    if (
      session.count >= this.config.sessionLimit ||
      sourceIp.count >= this.config.ipLimit ||
      this.dailyRequests >= this.config.globalRequestCap ||
      this.reservedSpend + this.config.requestReservationUsd >
        this.config.globalSpendCapUsd
    )
      throw new UsageLimitError();

    session.count += 1;
    sourceIp.count += 1;
    this.dailyRequests += 1;
    this.reservedSpend += this.config.requestReservationUsd;
  }

  private currentCounter(
    map: Map<string, WindowCounter>,
    key: string,
    now: number,
  ) {
    const existing = map.get(key);
    if (existing && now - existing.startedAt < this.config.rateWindowMs)
      return existing;
    const next = { startedAt: now, count: 0 };
    map.set(key, next);
    return next;
  }

  private rollDay(now: number) {
    const nextDay = utcDay(now);
    if (nextDay === this.day) return;
    this.day = nextDay;
    this.dailyRequests = 0;
    this.reservedSpend = 0;
  }
}

function utcDay(now: number) {
  return new Date(now).toISOString().slice(0, 10);
}
