export interface Logger {
  info(message: string): void
  warn(message: string): void
  error(message: string): void
}

function line(level: string, message: string) {
  return `${new Date().toISOString()} ${level} ${message}`
}

export const consoleLogger: Logger = {
  info: message => console.log(line('INFO ', message)),
  warn: message => console.warn(line('WARN ', message)),
  error: message => console.error(line('ERROR', message)),
}
