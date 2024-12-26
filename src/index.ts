#!/usr/bin/env bun
import { spawn } from "child_process";
import readline from "readline";
import { Command, Processes, Group, ReadyPatterns } from "./types/index.js";
import { program } from "commander";
import { appendFile } from "fs";
import path from "path";

// Format: YYYY-MM-DD_HH-mm-ss
function formatTimestamp(date: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

function formatLogPath(logPath: string): string | null {
  try {
    if (!logPath) return null;
    return `output_${formatTimestamp()}.log`;
  } catch (error) {
    console.error(`Failed to format log path: ${error}`);
    return null;
  }
}

const PANEL_WIDTH = 30;

/**
 * Manages multiple concurrent processes with dependencies, logging, and interactive filtering.
 * Provides a terminal UI for monitoring and controlling processes.
 */
export class ProcessManager {
  private currentFilter: string | null = null;
  private currentLogLine = 1;
  private processes: Processes = {};
  private processStates: { [key: string]: "running" | "stopped" } = {};
  private processReady: { [key: string]: boolean } = {};
  private dependencyReady: { [key: string]: { [dep: string]: boolean } } = {};
  private pendingProcesses: Set<string> = new Set();
  private commands: Command[];
  private groups: Group[];
  private logBuffers: {
    [key: string]: { data: string; color: string; timestamp: number }[];
  } = {};
  private maxLogsPerProcess: number;
  private isCleaningUp = false;
  private isUpdating = false;
  private logFile: string | null = null;
  private logQueue: string[] = [];
  private isWritingLogs = false;
  private logFlushInterval: NodeJS.Timer | null = null;
  private logPromiseQueue: Promise<void> = Promise.resolve();
  private searchMode = false;
  private searchText = "";
  private searchBuffer = "";

  constructor(
    commands: Command[],
    groups: Group[] = [],
    maxLogsPerProcess = 100,
    logFile: string | null = null
  ) {
    this.commands = commands;
    this.groups = groups;
    this.maxLogsPerProcess = maxLogsPerProcess;
    this.logFile = logFile;
    if (logFile && !this.logFile) {
      console.warn(
        "Invalid log file path provided. File logging will be disabled."
      );
    }
    commands.forEach(({ name }) => {
      this.logBuffers[name] = [];
      this.processStates[name] = "running";
    });

    // Set up log flushing interval if logging is enabled
    if (this.logFile) {
      this.logFlushInterval = setInterval(() => {
        this.logPromiseQueue = this.logPromiseQueue.then(() =>
          this.flushLogs()
        );
      }, 1000);
    }
  }

  private async queueLog(logEntry: string): Promise<void> {
    this.logPromiseQueue = this.logPromiseQueue.then(async () => {
      this.logQueue.push(logEntry);
      if (this.logQueue.length > 1000) {
        await this.flushLogs();
      }
    });
  }

  private async flushLogs(): Promise<void> {
    if (this.isWritingLogs || this.logQueue.length === 0 || !this.logFile)
      return;
    this.isWritingLogs = true;

    const logsToWrite = this.logQueue.join("");
    this.logQueue = [];

    try {
      await new Promise<void>((resolve, reject) => {
        appendFile(this.logFile!, logsToWrite, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } catch (e) {
      console.error(
        `Failed to write to log file: ${e}. File logging will be disabled.`
      );
      this.logFile = null;
      if (this.logFlushInterval) {
        clearInterval(this.logFlushInterval);
        this.logFlushInterval = null;
      }
    } finally {
      this.isWritingLogs = false;
    }
  }

  private hideCursor(): void {
    process.stdout.write("\x1B[?25l");
  }

  private showCursor(): void {
    process.stdout.write("\x1B[?25h");
  }

  private cleanup(): void {
    if (this.isCleaningUp) return;
    this.isCleaningUp = true;

    try {
      if (this.logFlushInterval) {
        clearInterval(this.logFlushInterval);
        this.logFlushInterval = null;
      }

      // Kill all processes first
      Object.values(this.processes).forEach((proc) => {
        try {
          proc.kill("SIGTERM");
        } catch (e) {
          // Ignore errors during cleanup
        }
      });

      // Reset terminal state and clear screen
      process.stdout.write("\x1B[?25h"); // Show cursor
      process.stdout.write("\x1B[2J"); // Clear screen
      process.stdout.write("\x1B[3J"); // Clear scrollback
      process.stdout.write("\x1B[H"); // Move to home
      process.stdout.write("\x1B[0m"); // Reset all attributes
      process.stdout.write("\x1B[!p"); // Soft reset terminal
      process.stdout.write("\x1Bc"); // Full reset

      // Display all logs in chronological order
      const allLogs = Object.entries(this.logBuffers)
        .flatMap(([name, logs]) =>
          logs.map((log) => ({
            name,
            ...log,
          }))
        )
        .sort((a, b) => a.timestamp - b.timestamp);

      // Print logs in clean format
      console.log(); // Add a blank line for readability
      allLogs.forEach((log) => {
        const cleanData = log.data
          .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "")
          .trimEnd();
        console.log(`[${log.name}] ${cleanData}`);
      });
      console.log(); // Add a blank line at the end

      // Final flush of any remaining logs to file
      if (this.logQueue.length > 0 && this.logFile) {
        this.logPromiseQueue
          .then(() => this.flushLogs())
          .finally(() => {
            process.exit(0);
          });
        return;
      }
    } catch (e) {
      console.error("Error during cleanup:", e);
    } finally {
      process.exit(0);
    }
  }

  /**
   * Adds a log entry for a specific process and updates the screen if necessary.
   * @param name - The name of the process
   * @param data - The log data to add
   * @param color - ANSI color code for the log entry
   */
  private addLog(name: string, data: string, color: string): void {
    const buffer = this.logBuffers[name];
    const timestamp = Date.now();
    buffer.push({ data, color, timestamp });
    if (buffer.length > this.maxLogsPerProcess) {
      buffer.shift();
    }

    // Write to log file if enabled
    if (this.logFile) {
      try {
        const cleanData = data.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "").trimEnd();
        const logEntry = `[${new Date(timestamp).toISOString()}] [${name}] ${cleanData}\n`;
        this.queueLog(logEntry).catch((e) => {
          console.error(
            `Failed to queue log: ${e}. File logging will be disabled.`
          );
          this.logFile = null;
          if (this.logFlushInterval) {
            clearInterval(this.logFlushInterval);
            this.logFlushInterval = null;
          }
        });
      } catch (e) {
        // Disable logging on first error to prevent spam
        console.error(
          `Failed to write to log file: ${e}. File logging will be disabled.`
        );
        this.logFile = null;
        if (this.logFlushInterval) {
          clearInterval(this.logFlushInterval);
          this.logFlushInterval = null;
        }
      }
    }

    if (
      !this.isUpdating &&
      (!this.currentFilter ||
        this.currentFilter === name ||
        (this.currentFilter.startsWith("group:") &&
          this.groups.find(
            (g) =>
              `group:${g.name}` === this.currentFilter &&
              g.commands.includes(name)
          )))
    ) {
      this.updateScreen();
    }
  }

  /**
   * Updates the terminal display with the current state of processes and logs.
   * Handles filtering and layout of the control panel and log output.
   */
  private updateScreen(): void {
    if (this.isUpdating || this.isCleaningUp) return;
    this.isUpdating = true;

    try {
      this.clearScreen();
      this.drawControlPanel();
      this.currentLogLine = 1;

      let logs: {
        name: string;
        data: string;
        color: string;
        timestamp: number;
      }[] = [];

      if (!this.currentFilter) {
        logs = Object.entries(this.logBuffers)
          .flatMap(([name, logs]) =>
            logs.map((log) => ({
              name: name as string,
              data: log.data,
              color: log.color,
              timestamp: log.timestamp,
            }))
          )
          .sort((a, b) => a.timestamp - b.timestamp);
      } else if (this.currentFilter.startsWith("group:")) {
        const groupName = this.currentFilter.replace("group:", "");
        const group = this.groups.find((g) => g.name === groupName);
        if (group) {
          logs = Object.entries(this.logBuffers)
            .filter(([name]) => group.commands.includes(name))
            .flatMap(([name, logs]) =>
              logs.map((log) => ({
                name: name as string,
                data: log.data,
                color: log.color,
                timestamp: log.timestamp,
              }))
            )
            .sort((a, b) => a.timestamp - b.timestamp);
        }
      } else {
        logs = (this.logBuffers[this.currentFilter] || []).map((log) => ({
          name: this.currentFilter as string,
          data: log.data,
          color: log.color,
          timestamp: log.timestamp,
        }));
      }

      // Add search filtering
      if (this.searchText) {
        logs = logs.filter(
          (log) =>
            log.data.toLowerCase().includes(this.searchText.toLowerCase()) ||
            log.name.toLowerCase().includes(this.searchText.toLowerCase())
        );
      }

      const maxVisible = (process.stdout.rows || 24) - 2;
      const visibleLogs = logs.slice(-maxVisible);

      visibleLogs.forEach((log) => {
        this.writeSingleLog(`${log.color}[${log.name}]\x1b[0m ${log.data}`);
      });
    } finally {
      this.isUpdating = false;
    }
  }

  private writeSingleLog(data: string): void {
    if (this.currentLogLine >= (process.stdout.rows || 24) - 1) {
      return;
    }

    const maxWidth = Math.max(
      10,
      (process.stdout.columns || 80) - PANEL_WIDTH - 2
    );
    const lines = data.toString().split("\n");

    lines.forEach((line) => {
      if (line.length > 0) {
        // Strip ANSI escape codes for length calculation
        const strippedLine = line.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "");

        // Find position in original line that corresponds to maxWidth visible chars
        let visibleChars = 0;
        let pos = 0;
        let inEscSeq = false;

        while (visibleChars < maxWidth && pos < line.length) {
          if (line[pos] === "\x1B") {
            inEscSeq = true;
          } else if (inEscSeq && /[a-zA-Z]/.test(line[pos])) {
            inEscSeq = false;
          } else if (!inEscSeq) {
            if (visibleChars + 1 > maxWidth) {
              break;
            }
            visibleChars++;
          }
          pos++;
        }

        // Ensure we don't cut in the middle of an escape sequence
        while (pos < line.length && inEscSeq) {
          if (/[a-zA-Z]/.test(line[pos])) {
            pos++;
            break;
          }
          pos++;
        }

        const truncatedLine = line.slice(0, pos);
        process.stdout.write(
          `\x1B[${this.currentLogLine};${PANEL_WIDTH + 2}H${truncatedLine}`
        );
        this.currentLogLine++;
      }
    });
  }

  public setFilter(name: string | null): void {
    this.currentFilter = name;
    this.updateScreen();
  }

  private toggleSearch(): void {
    this.searchMode = !this.searchMode;
    if (!this.searchMode) {
      this.searchText = "";
      this.searchBuffer = "";
    }
    this.updateScreen();
  }

  private drawControlPanel(): void {
    const terminalHeight = process.stdout.rows || 24;

    for (let i = 0; i < terminalHeight - 1; i++) {
      process.stdout.write(`\x1B[${i + 1};${PANEL_WIDTH}H│`);
    }

    process.stdout.write(`\x1B[1;1H\x1b[7m Controls \x1b[0m`);
    process.stdout.write(`\x1B[3;2H[↑/↓] Filter Output`);
    process.stdout.write(`\x1B[4;2H[r] Restart Process/Group`);
    process.stdout.write(`\x1B[5;2H[s] Stop/Start`);
    process.stdout.write(`\x1B[6;2H[f] Search/Filter`);
    process.stdout.write(`\x1B[7;2H[Ctrl+C] Exit`);

    process.stdout.write(`\x1B[9;1H\x1b[7m Available Processes \x1b[0m`);

    const isAllSelected = this.currentFilter === null;
    process.stdout.write(
      `\x1B[11;2H${isAllSelected ? "▶ " : "  "}\x1b[37m${
        isAllSelected ? "\x1b[7m" : ""
      }ALL\x1b[0m`
    );

    let currentLine = 12;

    // Draw groups
    this.groups.forEach((group) => {
      const isSelected = this.currentFilter === `group:${group.name}`;
      const prefix = isSelected ? "▶ " : "  ";
      const format = isSelected ? `${group.color}\x1b[7m` : group.color;
      const allRunning = group.commands.every(
        (cmd) => this.processStates[cmd] === "running"
      );
      const allStopped = group.commands.every(
        (cmd) => this.processStates[cmd] === "stopped"
      );
      const stateIcon = allRunning ? "⚡" : allStopped ? "⏸" : "⚡⏸";

      process.stdout.write(
        `\x1B[${currentLine};2H${prefix}${format}${stateIcon} [${group.name}]\x1b[0m`
      );
      currentLine++;

      // Draw group members indented
      group.commands.forEach((cmdName) => {
        const cmd = this.commands.find((c) => c.name === cmdName);
        if (cmd) {
          const isSelected = this.currentFilter === cmdName;
          const prefix = isSelected ? "▶ " : "  ";
          const format = isSelected ? `${cmd.color}\x1b[7m` : cmd.color;
          const state = this.processStates[cmdName];
          const stateIcon = state === "running" ? "⚡" : "⏸";

          process.stdout.write(
            `\x1B[${currentLine};4H${prefix}${format}${stateIcon} ${cmdName}\x1b[0m`
          );
          currentLine++;
        }
      });
    });

    // Draw ungrouped commands
    const ungroupedCommands = this.commands.filter((cmd) => !cmd.group);
    ungroupedCommands.forEach(({ name, color }) => {
      const isSelected = this.currentFilter === name;
      const prefix = isSelected ? "▶ " : "  ";
      const format = isSelected ? `${color}\x1b[7m` : color;
      const state = this.processStates[name];
      const stateIcon = state === "running" ? "⚡" : "⏸";

      process.stdout.write(
        `\x1B[${currentLine};2H${prefix}${format}${stateIcon} ${name}\x1b[0m`
      );
      currentLine++;
    });

    // Add search box display (after the process list)
    if (this.searchMode) {
      const searchPrompt = "Search: ";
      const searchY = process.stdout.rows - 4; // Move up to make room for border

      // Draw search box border and instructions
      process.stdout.write(
        `\x1B[${searchY};2H┌${"─".repeat(PANEL_WIDTH - 4)}┐`
      );
      process.stdout.write(
        `\x1B[${searchY + 1};2H│ ${searchPrompt}${this.searchBuffer}${" ".repeat(PANEL_WIDTH - 4 - searchPrompt.length - this.searchBuffer.length - 2)} │`
      );
      process.stdout.write(
        `\x1B[${searchY + 2};2H└${"─".repeat(PANEL_WIDTH - 4)}┘`
      );
      process.stdout.write(
        `\x1B[${searchY + 3};2H\x1b[90m[Enter] Submit · [Esc] Cancel\x1b[0m`
      );

      // Position cursor inside search box
      process.stdout.write(
        `\x1B[${searchY + 1};${4 + searchPrompt.length + this.searchBuffer.length}H`
      );
    }

    // If there's an active search, show it above the search box
    if (this.searchText) {
      const filterY = process.stdout.rows - 5; // Move up above search box
      process.stdout.write(
        `\x1B[${filterY};2H\x1b[33mFilter: ${this.searchText}\x1b[0m`
      );
    }
  }

  private clearScreen(): void {
    process.stdout.write("\x1bc");
    this.currentLogLine = 1;
  }

  private writeLog(data: string, store = true): void {
    try {
      if (this.currentLogLine >= (process.stdout.rows || 24) - 1) {
        this.currentLogLine = 1;
        this.updateScreen();
        return;
      }

      const maxWidth = Math.max(
        10,
        (process.stdout.columns || 80) - PANEL_WIDTH - 2
      );
      const lines = data.toString().split("\n");

      lines.forEach((line) => {
        if (line.length > 0) {
          const truncatedLine = line.slice(0, maxWidth);
          try {
            process.stdout.write(`\x1B[s`);
            process.stdout.write(
              `\x1B[${this.currentLogLine};${PANEL_WIDTH + 2}H${truncatedLine}`
            );
            process.stdout.write(`\x1B[u`);
            this.currentLogLine++;
          } catch (e) {
            // Ignore write errors
          }
        }
      });

      this.updateScreen();
    } catch (e) {
      if (!this.isCleaningUp) {
        this.cleanup();
      }
    }
  }

  /**
   * Starts a process and sets up its event handlers.
   * Handles process dependencies and ready patterns.
   * @param name - Name of the process to start
   */
  private async startProcess(name: string): Promise<void> {
    const command = this.commands.find((cmd) => cmd.name === name);
    if (!command) return;

    if (command.dependsOn?.length) {
      const unreadyDeps = command.dependsOn.filter((dep) => {
        const hasReadyPattern = !!command.readyPatterns?.[dep.toLowerCase()];
        const isProcessRunning = this.processStates[dep] === "running";
        const hasSeenPattern = this.dependencyReady[name]?.[dep.toLowerCase()];

        if (hasReadyPattern) {
          return !isProcessRunning || !hasSeenPattern;
        }
        return !isProcessRunning;
      });

      if (unreadyDeps.length > 0) {
        this.pendingProcesses.add(name);
        this.addLog(
          name,
          `Waiting for dependencies: ${unreadyDeps.join(", ")}`,
          command.color
        );
        return;
      }
    }

    const [cmd, ...args] = command.cmd.split(" ");
    const proc = spawn(cmd, args, {
      shell: true,
      env: {
        ...process.env,
        FORCE_COLOR: "true",
        NODE_ENV: "development",
        TERM: "xterm-256color",
      },
      stdio: ["inherit", "pipe", "pipe"],
      cwd: process.cwd(),
    });

    this.processes[name] = proc;
    this.processStates[name] = "running";
    this.setupProcessHandlers(name, proc, command.color);
  }

  /**
   * Sets up stdout, stderr and exit handlers for a process.
   * Manages ready patterns and dependency tracking.
   * @param name - Name of the process
   * @param proc - The spawned child process
   * @param color - ANSI color code for process output
   */
  private setupProcessHandlers(name: string, proc: any, color: string): void {
    const command = this.commands.find((cmd) => cmd.name === name);

    proc.stdout?.on("data", (data: Buffer) => {
      const logData = data.toString();
      this.addLog(name, logData, color);

      this.commands.forEach((waitingCmd) => {
        if (
          waitingCmd.dependsOn?.includes(name) &&
          waitingCmd.readyPatterns?.[name.toLowerCase()]
        ) {
          const pattern = new RegExp(
            waitingCmd.readyPatterns[name.toLowerCase()]
          );
          if (pattern.test(logData)) {
            this.dependencyReady[waitingCmd.name] =
              this.dependencyReady[waitingCmd.name] || {};
            this.dependencyReady[waitingCmd.name][name.toLowerCase()] = true;
            this.startPendingProcesses();
          }
        }
      });
    });

    proc.stderr?.on("data", (data: Buffer) => {
      const logData = data.toString();
      this.addLog(name, logData, color);
    });

    proc.on("error", (error: Error) => {
      this.addLog(name, `Process error: ${error.message}`, color);
      this.processStates[name] = "stopped";
    });

    proc.on("exit", (code: number | null, signal: string | null) => {
      if (code !== null) {
        this.addLog(name, `Process exited with code ${code}`, color);
      } else if (signal !== null) {
        this.addLog(name, `Process killed with signal ${signal}`, color);
      }
      this.processStates[name] = "stopped";

      // Reset dependency ready states for processes waiting on us
      this.commands.forEach((cmd) => {
        if (cmd.dependsOn?.includes(name)) {
          if (this.dependencyReady[cmd.name]) {
            this.dependencyReady[cmd.name][name.toLowerCase()] = false;
          }
        }
      });
    });
  }

  /**
   * Checks and starts any pending processes whose dependencies are now satisfied.
   */
  private async startPendingProcesses(): Promise<void> {
    for (const name of this.pendingProcesses) {
      const command = this.commands.find((cmd) => cmd.name === name);
      if (!command) continue;

      const unreadyDeps = command.dependsOn?.filter((dep) => {
        const hasReadyPattern = !!command.readyPatterns?.[dep.toLowerCase()];
        const isProcessRunning = this.processStates[dep] === "running";
        const hasSeenPattern = this.dependencyReady[name]?.[dep.toLowerCase()];

        if (hasReadyPattern && (!isProcessRunning || !hasSeenPattern)) {
          return true;
        }
        return !isProcessRunning;
      });

      if (!unreadyDeps?.length) {
        this.pendingProcesses.delete(name);
        await this.startProcess(name);
      }
    }
  }

  public async toggleProcess(name: string): Promise<void> {
    if (!this.processes[name]) return;

    if (this.processStates[name] === "running") {
      this.processes[name].kill();
      this.processStates[name] = "stopped";
      this.addLog(
        name,
        "Process stopped",
        this.commands.find((c) => c.name === name)?.color || ""
      );
    } else {
      await this.startProcess(name);
      this.addLog(
        name,
        "Process started",
        this.commands.find((c) => c.name === name)?.color || ""
      );
    }
    this.updateScreen();
  }

  public async restartProcess(name: string): Promise<void> {
    if (!this.processes[name]) return;

    this.processes[name].kill();
    await this.startProcess(name);
    this.addLog(
      name,
      "Process restarted",
      this.commands.find((c) => c.name === name)?.color || ""
    );
    this.updateScreen();
  }

  private async toggleGroup(groupName: string): Promise<void> {
    const group = this.groups.find((g) => g.name === groupName);
    if (!group) return;

    const allRunning = group.commands.every(
      (cmd) => this.processStates[cmd] === "running"
    );

    for (const cmdName of group.commands) {
      if (allRunning) {
        if (this.processes[cmdName]) {
          this.processes[cmdName].kill();
          this.processStates[cmdName] = "stopped";
          this.addLog(
            cmdName,
            "Process stopped",
            this.commands.find((c) => c.name === cmdName)?.color || ""
          );
        }
      } else {
        await this.startProcess(cmdName);
        this.addLog(
          cmdName,
          "Process started",
          this.commands.find((c) => c.name === cmdName)?.color || ""
        );
      }
    }
    this.updateScreen();
  }

  private async restartGroup(groupName: string): Promise<void> {
    const group = this.groups.find((g) => g.name === groupName);
    if (!group) return;

    for (const cmdName of group.commands) {
      if (this.processes[cmdName]) {
        this.processes[cmdName].kill();
        await this.startProcess(cmdName);
        this.addLog(
          cmdName,
          "Process restarted",
          this.commands.find((c) => c.name === cmdName)?.color || ""
        );
      }
    }
    this.updateScreen();
  }

  public start(): void {
    // Ensure raw mode and handle its errors
    const enableRawMode = () => {
      try {
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(true);
          process.stdin.resume();
        }
      } catch (e) {
        console.error("Failed to set raw mode");
        process.exit(1);
      }
    };

    // Set up cleanup handlers first
    const setupCleanup = () => {
      process.on("uncaughtException", (e) => {
        console.error("Uncaught exception:", e);
        this.cleanup();
      });

      process.on("unhandledRejection", (e) => {
        console.error("Unhandled rejection:", e);
        this.cleanup();
      });

      process.on("SIGINT", () => this.cleanup());
      process.on("SIGTERM", () => this.cleanup());
      process.on("exit", () => {
        if (!this.isCleaningUp) {
          this.cleanup();
        }
      });
    };

    setupCleanup();
    enableRawMode();
    readline.emitKeypressEvents(process.stdin);

    this.hideCursor();

    // Throttle resize events
    let resizeTimeout: ReturnType<typeof setTimeout>;
    process.stdout.on("resize", () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this.updateScreen();
      }, 100);
    });

    process.stdin.on("keypress", (str, key) => {
      if (this.searchMode) {
        if (key.name === "escape" || (key.ctrl && key.name === "c")) {
          this.toggleSearch();
          return;
        }

        if (key.name === "return") {
          this.searchText = this.searchBuffer;
          this.updateScreen();
          return;
        }

        if (key.name === "backspace") {
          this.searchBuffer = this.searchBuffer.slice(0, -1);
          this.updateScreen();
          return;
        }

        if (str && !key.ctrl) {
          this.searchBuffer += str;
          this.updateScreen();
          return;
        }

        return;
      }

      if (key.name === "f") {
        this.toggleSearch();
        return;
      }

      if (key.ctrl && key.name === "c") {
        this.cleanup();
      }

      if (key.name === "up" || key.name === "down") {
        // Create a flat list of items in display order
        const allItems = [
          null, // ALL
          ...this.groups.flatMap((g) => [
            `group:${g.name}`,
            ...g.commands.map((cmd) => cmd),
          ]),
          ...this.commands.filter((cmd) => !cmd.group).map((cmd) => cmd.name),
        ];

        const currentIndex = allItems.indexOf(this.currentFilter);
        if (key.name === "up") {
          this.currentFilter =
            currentIndex > 0
              ? allItems[currentIndex - 1]
              : allItems[allItems.length - 1];
        } else {
          this.currentFilter =
            currentIndex < allItems.length - 1
              ? allItems[currentIndex + 1]
              : allItems[0];
        }
        this.updateScreen();
      }

      if (key.name === "r" && this.currentFilter) {
        if (this.currentFilter.startsWith("group:")) {
          this.restartGroup(this.currentFilter.replace("group:", ""));
        } else {
          this.restartProcess(this.currentFilter);
        }
      }

      if (key.name === "s" && this.currentFilter) {
        if (this.currentFilter.startsWith("group:")) {
          this.toggleGroup(this.currentFilter.replace("group:", ""));
        } else {
          this.toggleProcess(this.currentFilter);
        }
      }
    });

    // Sort commands by dependencies
    const sortedCommands = this.sortCommandsByDependencies();

    // Start processes in dependency order
    sortedCommands.forEach(({ name }) => {
      this.startProcess(name);
    });

    process.on("SIGINT", () => {
      this.cleanup();
    });

    // Also handle other exit signals
    process.on("SIGTERM", () => {
      this.cleanup();
    });

    process.on("exit", () => {
      this.showCursor();
    });

    this.clearScreen();
    this.drawControlPanel();
  }

  /**
   * Sorts commands topologically based on their dependencies.
   * @returns Sorted array of commands in dependency order
   */
  private sortCommandsByDependencies(): Command[] {
    const visited = new Set<string>();
    const sorted: Command[] = [];

    const visit = (command: Command) => {
      if (visited.has(command.name)) return;
      visited.add(command.name);

      command.dependsOn?.forEach((dep) => {
        const depCommand = this.commands.find((cmd) => cmd.name === dep);
        if (depCommand) visit(depCommand);
      });

      sorted.push(command);
    };

    this.commands.forEach((command) => visit(command));
    return sorted;
  }
}

/**
 * Parses ready patterns from a string format into a ReadyPatterns object.
 * Format: {dep1: 'pattern1', dep2: 'pattern2'}
 * @param patternsStr - String containing ready patterns
 * @returns Parsed ReadyPatterns object or undefined if parsing fails
 */
function parseReadyPatterns(patternsStr: string): ReadyPatterns | undefined {
  try {
    // Remove leading/trailing whitespace and braces
    const cleaned = patternsStr.trim().replace(/^\{|\}$/g, "");
    // Split by commas not inside quotes
    const pairs = cleaned.split(/,(?=(?:[^']*'[^']*')*[^']*$)/);

    const patterns: ReadyPatterns = {};
    pairs.forEach((pair) => {
      const [key, value] = pair.split(":").map((s) => s.trim());
      // Remove quotes and whitespace
      patterns[key] = value.replace(/^'|'$/g, "");
    });
    return patterns;
  } catch (e) {
    return undefined;
  }
}

// Run CLI directly
program
  .name("sinfonia")
  .description("Run multiple commands in parallel with interactive filtering")
  .version("1.0.0")
  .argument(
    "<commands...>",
    "Commands to run (format: [GROUP:]NAME[@DEP1,DEP2]=COMMAND[:: {DEP1: 'pattern', DEP2: 'pattern'}])"
  )
  .option(
    "-c, --color <colors>",
    "Colors for each command (comma-separated)",
    "blue,green,yellow,magenta,cyan"
  )
  .option(
    "-b, --buffer-size <size>",
    "Number of log lines to keep in memory per process",
    "100"
  )
  .option(
    "-l, --log-file <file>",
    "Save logs to file (use {timestamp} for current date/time)",
    "sinfonia_{timestamp}.log"
  )
  .action((commands: string[], options) => {
    const colors = options.color
      .split(",")
      .map((c: string) => `\x1b[${getColorCode(c)}m`);

    const groups: Group[] = [];
    const parsedCommands: Command[] = [];
    let colorIndex = 0;

    // Format the log file path if provided
    const logFile = options.logFile ? formatLogPath(options.logFile) : null;

    commands.forEach((cmd) => {
      // Split into parts: nameWithGroup=command :: patterns
      const [nameAndCmd, patternsStr] = cmd.split(" :: ");
      const [nameWithGroup, command] = nameAndCmd.split("=");

      // Parse dependencies
      const [fullName, depsStr] = nameWithGroup.split("@");
      const deps = depsStr?.split(",").filter(Boolean);

      // Parse group and name
      const [groupName, name] = fullName.includes(":")
        ? fullName.split(":")
        : [undefined, fullName];

      // Parse ready patterns if they exist
      const readyPatterns = patternsStr
        ? parseReadyPatterns(patternsStr)
        : undefined;

      if (groupName) {
        let group = groups.find((g) => g.name === groupName.toUpperCase());
        if (!group) {
          group = {
            name: groupName.toUpperCase(),
            color: colors[colorIndex++ % colors.length],
            commands: [],
          };
          groups.push(group);
        }
        group.commands.push(name.toUpperCase());
      }

      parsedCommands.push({
        name: name.toUpperCase(),
        cmd: command,
        color: colors[colorIndex++ % colors.length],
        group: groupName?.toUpperCase(),
        dependsOn: deps?.map((d) => d.toUpperCase()),
        readyPatterns,
      });
    });

    const bufferSize = parseInt(options.bufferSize, 10);
    if (isNaN(bufferSize) || bufferSize < 1) {
      console.error("Buffer size must be a positive number");
      process.exit(1);
    }

    console.log("Starting processes...");
    const manager = new ProcessManager(
      parsedCommands,
      groups,
      bufferSize,
      logFile
    );
    manager.start();
  });

/**
 * Maps color names to ANSI color codes.
 * @param color - Name of the color
 * @returns ANSI color code string
 */
function getColorCode(color: string): string {
  const codes: Record<string, string> = {
    black: "30",
    red: "31",
    green: "32",
    yellow: "33",
    blue: "34",
    magenta: "35",
    cyan: "36",
    white: "37",
  };
  return codes[color.toLowerCase()] || "37";
}

program.parse();
