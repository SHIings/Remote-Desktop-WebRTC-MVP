type LogLevel = 'INFO' | 'WARN' | 'ERROR';

const writeLog = (level: LogLevel, message: string, context?: Record<string, unknown>): void => {
  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
    ...context
  };

  const line = JSON.stringify(payload);

  if (level === 'ERROR') {
    console.error(line);
    return;
  }

  if (level === 'WARN') {
    console.warn(line);
    return;
  }

  console.log(line);
};

export const logger = {
  info: (message: string, context?: Record<string, unknown>): void =>
    writeLog('INFO', message, context),
  warn: (message: string, context?: Record<string, unknown>): void =>
    writeLog('WARN', message, context),
  error: (message: string, context?: Record<string, unknown>): void =>
    writeLog('ERROR', message, context)
};
