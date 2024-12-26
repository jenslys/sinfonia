import { appendFileSync } from "node:fs";

export interface LogBuffer {
  data: string;
  color: string;
  timestamp: number;
}

export interface LogState {
  logBuffers: { [key: string]: LogBuffer[] };
  maxLogsPerProcess: number;
  logFile: string | null;
  logQueue: string[];
  isWritingLogs: boolean;
  logFlushInterval: NodeJS.Timer | null;
  logPromiseQueue: Promise<void>;
}

export class LogManager {
  constructor(private state: LogState) {}

  async queueLog(logEntry: string): Promise<void> {
    this.state.logPromiseQueue = this.state.logPromiseQueue.then(async () => {
      this.state.logQueue.push(logEntry);
      if (this.state.logQueue.length > 1000) {
        await this.flushLogs();
      }
    });
  }

  async flushLogs(): Promise<void> {
    if (this.state.isWritingLogs || this.state.logQueue.length === 0 || !this.state.logFile) return;
    this.state.isWritingLogs = true;

    const logsToWrite = this.state.logQueue.join("");
    this.state.logQueue = [];

    try {
      appendFileSync(this.state.logFile, logsToWrite);
    } catch (e) {
      console.error(`Failed to write to log file: ${e}. File logging will be disabled.`);
      this.state.logFile = null;
      if (this.state.logFlushInterval) {
        clearInterval(this.state.logFlushInterval);
        this.state.logFlushInterval = null;
      }
    } finally {
      this.state.isWritingLogs = false;
    }
  }

  addLog(name: string, data: string, color: string): void {
    const buffer = this.state.logBuffers[name];
    const timestamp = Date.now();
    buffer.push({ data, color, timestamp });
    if (buffer.length > this.state.maxLogsPerProcess) {
      buffer.shift();
    }

    if (this.state.logFile) {
      try {
        const cleanData = data.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "").trimEnd();
        const logEntry = `[${name}] ${cleanData}\n`;
        appendFileSync(this.state.logFile, logEntry);
      } catch (e) {
        console.error(`Failed to write to log file: ${e}. File logging will be disabled.`);
        this.state.logFile = null;
        if (this.state.logFlushInterval) {
          clearInterval(this.state.logFlushInterval);
          this.state.logFlushInterval = null;
        }
      }
    }
  }

  getAllLogs(): { name: string; data: string; color: string; timestamp: number }[] {
    return Object.entries(this.state.logBuffers)
      .flatMap(([name, logs]) =>
        logs.map((log) => ({
          name,
          ...log,
        }))
      )
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  cleanup(): void {
    if (this.state.logFlushInterval) {
      clearInterval(this.state.logFlushInterval);
      this.state.logFlushInterval = null;
    }
  }
}
