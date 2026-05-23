import * as winston from 'winston';
import * as path from 'path';
import DailyRotateFile from 'winston-daily-rotate-file';

// Create logs directory path
const logsDir = path.join(__dirname, '..', 'logs');

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
    let msg = `${timestamp} [${level}]`;
    if (context) msg += ` [${context}]`;
    msg += ` ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Custom format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
    let msg = `${timestamp} [${level}]`;
    if (context) msg += ` [${context}]`;
    msg += ` ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Create transports array
const transports: winston.transport[] = [
  // Console transport
  new winston.transports.Console({
    format: consoleFormat,
  }),

  // Error log file
  new DailyRotateFile({
    filename: path.join(logsDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '500k', // 500KB per file
    maxFiles: '14d', // Keep for 14 days
    level: 'error',
    format: fileFormat,
  }),
  // Combined log file
  new DailyRotateFile({
    filename: path.join(logsDir, 'combined-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '500k', // 500KB per file
    maxFiles: '14d', // Keep for 14 days
    format: fileFormat,
  }),
];

// Create and export the logger
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { service: 'helix-api' },
  transports,
});

// Helper function to create a child logger with context
export function createLogger(context: string) {
  return logger.child({ context });
}

// Export a method to write startup logs to file
export function writeStartupLog(message: string) {
  const timestamp = new Date().toISOString();
  const logLine = `${timestamp} [info] ${message}\n`;
  const logPath = path.join(logsDir, 'startup.log');

  try {
    const fs = require('fs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    fs.appendFileSync(logPath, logLine);
  } catch (error) {
    // Ignore file write errors during startup
  }
}
