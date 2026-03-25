export type Logger = {
  error: (message?: any, ...data: any[]) => void;
  warn: (message?: any, ...data: any[]) => void;
  info: (message?: any, ...data: any[]) => void;
  debug: (message?: any, ...data: any[]) => void;
};

function timestamp(): string {
  return new Date().toISOString();
}

function write(level: string, message?: any, ...data: any[]): void {
  const line = `${timestamp()}: ${level.padEnd(10)}: ${message}`;
  data.length > 0 ? console.error(line, ...data) : console.error(line);
}

export function create_logger(): Logger {
  return {
    error: (message, ...data) => write("ERROR \u274C", message, ...data),
    warn: (message, ...data) => write("WARNING \u26A0\uFE0F", message, ...data),
    info: (message, ...data) => write("INFO", message, ...data),
    debug: (message, ...data) => write("DEBUG", message, ...data),
  };
}
