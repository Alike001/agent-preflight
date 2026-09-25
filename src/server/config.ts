export interface ServerConfig {
  port: number;
  servApiKey: string;
  servModel: string;
  rateWindowMs: number;
  sessionLimit: number;
  ipLimit: number;
  globalRequestCap: number;
  globalSpendCapUsd: number;
  requestReservationUsd: number;
}

export function loadServerConfig(
  env: NodeJS.ProcessEnv = process.env,
): ServerConfig {
  return {
    port: positiveInteger(env.PORT, 8787),
    servApiKey: env.SERV_API_KEY?.trim() ?? "",
    servModel: env.SERV_MODEL?.trim() || "gpt-5.4-mini",
    rateWindowMs:
      positiveInteger(env.SERV_RATE_LIMIT_WINDOW_SECONDS, 900) * 1000,
    sessionLimit: positiveInteger(env.SERV_SESSION_REQUEST_LIMIT, 5),
    ipLimit: positiveInteger(env.SERV_IP_REQUEST_LIMIT, 20),
    globalRequestCap: positiveInteger(env.SERV_GLOBAL_REQUEST_CAP, 100),
    globalSpendCapUsd: positiveNumber(env.SERV_GLOBAL_SPEND_CAP_USD, 1),
    requestReservationUsd: positiveNumber(
      env.SERV_ESTIMATED_MAX_COST_PER_REQUEST_USD,
      0.02,
    ),
  };
}

function positiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0)
    throw new Error("Server usage protection configuration is invalid.");
  return parsed;
}

function positiveNumber(value: string | undefined, fallback: number): number {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0)
    throw new Error("Server usage protection configuration is invalid.");
  return parsed;
}
