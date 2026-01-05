type LogLevel = "info" | "warn" | "error";

type LogMeta = Record<string, unknown>;

const LEVEL_ORDER: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
};

const LOG_LEVEL = (process.env.LOG_LEVEL || "info") as LogLevel;
const MIN_LEVEL = LEVEL_ORDER[LOG_LEVEL] ?? LEVEL_ORDER.info;

function log(level: LogLevel, message: string, meta?: LogMeta) {
  if (LEVEL_ORDER[level] > MIN_LEVEL) return;
  const payload: Record<string, unknown> = {
    level,
    message,
    time: new Date().toISOString(),
  };
  if (meta && Object.keys(meta).length > 0) {
    payload.meta = meta;
  }
  const output = JSON.stringify(payload);
  if (level === "error") {
    console.error(output);
  } else if (level === "warn") {
    console.warn(output);
  } else {
    console.info(output);
  }
}

export function logInfo(message: string, meta?: LogMeta) {
  log("info", message, meta);
}

export function logWarn(message: string, meta?: LogMeta) {
  log("warn", message, meta);
}

export function logError(message: string, meta?: LogMeta) {
  log("error", message, meta);
}
