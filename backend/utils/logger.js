/**
 * logger.js
 * Centralised, structured terminal logger for the Samagama backend.
 *
 * Levels  : INFO | WARN | ERROR | DEBUG | SUCCESS
 * Outputs : Timestamped, level-prefixed lines to stdout / stderr
 * Security: Never logs sensitive values (URIs, tokens, secrets)
 */

const LEVEL = {
  INFO:    { label: 'INFO   ', stream: 'stdout' },
  SUCCESS: { label: 'SUCCESS', stream: 'stdout' },
  WARN:    { label: 'WARN   ', stream: 'stderr' },
  ERROR:   { label: 'ERROR  ', stream: 'stderr' },
  DEBUG:   { label: 'DEBUG  ', stream: 'stdout' },
};

function timestamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 23);
}

function write(level, module, message) {
  const { label, stream } = LEVEL[level] || LEVEL.INFO;
  const line = `[${timestamp()}] [${label}] [${module.padEnd(20)}] ${message}`;
  if (stream === 'stderr') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

const logger = {
  info:    (module, msg) => write('INFO',    module, msg),
  success: (module, msg) => write('SUCCESS', module, msg),
  warn:    (module, msg) => write('WARN',    module, msg),
  error:   (module, msg) => write('ERROR',   module, msg),
  debug:   (module, msg) => {
    if (process.env.NODE_ENV !== 'production') write('DEBUG', module, msg);
  },

  /**
   * Prints the server startup banner without exposing any credentials.
   */
  banner(port) {
    const line = '─'.repeat(56);
    process.stdout.write(`
┌${line}┐
│  Samagama API Server                                   │
│  Environment : ${(process.env.NODE_ENV || 'development').padEnd(38)}│
│  Port        : ${String(port).padEnd(38)}│
│  Started     : ${timestamp().padEnd(38)}│
└${line}┘\n`);
  },
};

export default logger;
