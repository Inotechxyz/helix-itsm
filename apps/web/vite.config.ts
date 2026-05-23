import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

// Setup file logging for Vite server
const logsDir = path.join(__dirname, 'logs');

// Ensure logs directory exists
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const getDateString = () => new Date().toISOString().split('T')[0];
const getLogFilename = (type: string) => path.join(logsDir, `${type}-${getDateString()}.log`);

const writeLog = (type: string, message: string) => {
  const timestamp = new Date().toISOString();
  const logLine = `${timestamp} [${type}] ${message}\n`;
  const filename = getLogFilename(type);

  try {
    fs.appendFileSync(filename, logLine);

    // Check file size and rotate if needed (500KB limit)
    const stats = fs.statSync(filename);
    if (stats.size > 500 * 1024) {
      const archiveName = filename.replace('.log', `-${Date.now()}.log`);
      fs.renameSync(filename, archiveName);
    }
  } catch {
    // Ignore file write errors
  }
};

// Store original console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleInfo = console.info;

// Override console methods to write to file
console.log = (...args) => {
  originalConsoleLog.apply(console, args);
  writeLog('combined', args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '));
};

console.error = (...args) => {
  originalConsoleError.apply(console, args);
  writeLog('error', args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '));
};

console.warn = (...args) => {
  originalConsoleWarn.apply(console, args);
  writeLog('combined', `[WARN] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}`);
};

console.info = (...args) => {
  originalConsoleInfo.apply(console, args);
  writeLog('combined', args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '));
};

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@helix/shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/v1': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      '/api/chatbot': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        rewrite: (path: string) => path.replace(/^\/api\/chatbot/, '/chatbot'),
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
