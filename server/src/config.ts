const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
};

export interface ServerConfig {
  port: number;
  heartbeatIntervalMs: number;
  idleTimeoutMs: number;
}

export const getServerConfig = (): ServerConfig => {
  return {
    port: parsePositiveInt(process.env.PORT, 8080),
    heartbeatIntervalMs: parsePositiveInt(process.env.HEARTBEAT_INTERVAL_MS, 15_000),
    idleTimeoutMs: parsePositiveInt(process.env.IDLE_TIMEOUT_MS, 45_000)
  };
};
