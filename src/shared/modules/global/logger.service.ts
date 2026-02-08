import {
  Injectable,
  LoggerService as NestLoggerService,
  LogLevel,
} from '@nestjs/common';
import { createLogger, format, Logger, transports } from 'winston';

@Injectable()
export class LoggerService implements NestLoggerService {
  private context?: string;
  private readonly logger: Logger;

  constructor(context?: string) {
    this.context = context;
    this.logger = createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: format.combine(
        format.timestamp(),
        format.printf((entry) => {
          const timestamp =
            typeof entry.timestamp === 'string'
              ? entry.timestamp
              : new Date().toISOString();
          const level =
            typeof entry.level === 'string'
              ? entry.level.toUpperCase()
              : 'INFO';
          const contextText =
            typeof entry.context === 'string' ? entry.context : undefined;
          const messageText = this.serializeMessage(entry.message);

          return `[${timestamp}] [${level}] ${contextText ? `[${contextText}] ` : ''}${messageText}`;
        }),
      ),
      transports: [new transports.Console()],
    });
  }

  static forRoot(context: string): LoggerService {
    return new LoggerService(context);
  }

  setContext(context: string): void {
    this.context = context;
  }

  log(message: any, context?: string): void {
    this.printMessage('log', message, context || this.context);
  }

  error(message: any, trace?: string, context?: string): void {
    if (trace) {
      this.printMessage(
        'error',
        `${this.serializeMessage(message)} | trace=${trace}`,
        context || this.context,
      );
      return;
    }
    this.printMessage('error', message, context || this.context);
  }

  warn(message: any, context?: string): void {
    this.printMessage('warn', message, context || this.context);
  }

  debug(message: any, context?: string): void {
    this.printMessage('debug', message, context || this.context);
  }

  verbose(message: any, context?: string): void {
    this.printMessage('verbose', message, context || this.context);
  }

  private printMessage(level: LogLevel, message: any, context?: string): void {
    const normalizedMessage = this.serializeMessage(message);

    if (level === 'log') {
      this.logger.info(normalizedMessage, { context });
      return;
    }

    this.logger.log(level, normalizedMessage, { context });
  }

  private serializeMessage(message: any): string {
    if (typeof message === 'string') {
      return message;
    }

    try {
      return JSON.stringify(message);
    } catch {
      return String(message);
    }
  }
}
