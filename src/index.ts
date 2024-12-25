#!/usr/bin/env bun
import { spawn } from "child_process";
import readline from "readline";
import { Command, Processes } from "./types/index.js";
import { program } from "commander";

const PANEL_WIDTH = 25;

export class ProcessManager {
  private currentFilter: string | null = null;
  private currentLogLine = 1;
  private processes: Processes = {};
  private processStates: { [key: string]: "running" | "stopped" } = {};
  private commands: Command[];
  private logBuffers: {
    [key: string]: { data: string; color: string; timestamp: number }[];
  } = {};
  private maxLogsPerProcess: number;
  private isCleaningUp = false;
  private isUpdating = false;

  constructor(commands: Command[], maxLogsPerProcess = 100) {
    this.commands = commands;
    this.maxLogsPerProcess = maxLogsPerProcess;
    commands.forEach(({ name }) => {
      this.logBuffers[name] = [];
      this.processStates[name] = "running";
    });
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
      process.stdout.write("\x1B[?25h"); // Show cursor
      process.stdout.write("\x1B[2J"); // Clear screen
      process.stdout.write("\x1B[H"); // Move to home position
      process.stdout.write("\x1B[0m"); // Reset all attributes

      Object.values(this.processes).forEach((proc) => {
        try {
          proc.kill("SIGTERM");
        } catch (e) {
          // Ignore errors during cleanup
        }
      });
    } catch (e) {
      // Ensure we exit even if cleanup fails
    } finally {
      process.exit(0);
    }
  }

  private addLog(name: string, data: string, color: string): void {
    const buffer = this.logBuffers[name];
    buffer.push({ data, color, timestamp: Date.now() });
    if (buffer.length > this.maxLogsPerProcess) {
      buffer.shift();
    }

    if (
      !this.isUpdating &&
      (!this.currentFilter || this.currentFilter === name)
    ) {
      this.updateScreen();
    }
  }

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
      } else {
        logs = (this.logBuffers[this.currentFilter] || []).map((log) => ({
          name: this.currentFilter as string,
          data: log.data,
          color: log.color,
          timestamp: log.timestamp,
        }));
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
        const truncatedLine = line.slice(0, maxWidth);
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

  private drawControlPanel(): void {
    const terminalHeight = process.stdout.rows || 24;

    for (let i = 0; i < terminalHeight - 1; i++) {
      process.stdout.write(`\x1B[${i + 1};${PANEL_WIDTH}H│`);
    }

    process.stdout.write(`\x1B[1;1H\x1b[7m Controls \x1b[0m`);
    process.stdout.write(`\x1B[3;2H[↑/↓] Filter Output`);
    process.stdout.write(`\x1B[4;2H[r] Restart Process`);
    process.stdout.write(`\x1B[5;2H[s] Stop/Start`);
    process.stdout.write(`\x1B[6;2H[Ctrl+C] Exit`);

    process.stdout.write(`\x1B[9;1H\x1b[7m Available Processes \x1b[0m`);

    const isAllSelected = this.currentFilter === null;
    process.stdout.write(
      `\x1B[11;2H${isAllSelected ? "▶ " : "  "}\x1b[37m${
        isAllSelected ? "\x1b[7m" : ""
      }ALL\x1b[0m`
    );

    this.commands.forEach(({ name, color }, index) => {
      const isSelected = this.currentFilter === name;
      const prefix = isSelected ? "▶ " : "  ";
      const format = isSelected ? `${color}\x1b[7m` : color;
      const state = this.processStates[name];
      const stateIcon = state === "running" ? "⚡" : "⏸";

      process.stdout.write(
        `\x1B[${12 + index};2H${prefix}${format}${stateIcon} ${name}\x1b[0m`
      );
    });
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

  private async startProcess(name: string): Promise<void> {
    const command = this.commands.find((cmd) => cmd.name === name);
    if (!command) return;

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

  private setupProcessHandlers(name: string, proc: any, color: string): void {
    proc.stdout?.on("data", (data: Buffer) => {
      const logData = data.toString();
      this.addLog(name, logData, color);
    });

    proc.stderr?.on("data", (data: Buffer) => {
      const logData = data.toString();
      this.addLog(name, logData, color);
    });

    proc.on("error", (error: Error) => {
      this.addLog(name, `Process error: ${error.message}`, color);
    });

    proc.on("exit", (code: number | null, signal: string | null) => {
      if (code !== null) {
        this.addLog(name, `Process exited with code ${code}`, color);
      } else if (signal !== null) {
        this.addLog(name, `Process killed with signal ${signal}`, color);
      }
      this.processStates[name] = "stopped";
    });
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
      if (key.ctrl && key.name === "c") {
        this.cleanup();
      }

      if (key.name === "up" || key.name === "down") {
        const currentIndex = this.currentFilter
          ? this.commands.findIndex((c) => c.name === this.currentFilter)
          : -1;

        if (key.name === "up") {
          this.currentFilter =
            currentIndex > 0 ? this.commands[currentIndex - 1].name : null;
        } else {
          this.currentFilter =
            currentIndex < this.commands.length - 1
              ? this.commands[currentIndex + 1].name
              : this.commands[0].name;
        }
        this.updateScreen();
      }

      // Add process control handlers
      if (key.name === "r" && this.currentFilter) {
        this.restartProcess(this.currentFilter);
      }

      if (key.name === "s" && this.currentFilter) {
        this.toggleProcess(this.currentFilter);
      }
    });

    this.commands.forEach(({ name, cmd, color }) => {
      const [command, ...args] = cmd.split(" ");
      const proc = spawn(command, args, {
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

      proc.stdout?.on("data", (data) => {
        const logData = data.toString();
        this.addLog(name, logData, color);
      });

      proc.stderr?.on("data", (data) => {
        const logData = data.toString();
        this.addLog(name, logData, color);
      });

      proc.on("error", (error) => {
        this.addLog(name, `Process error: ${error.message}`, color);
        if (error.message.includes("ENOENT")) {
          this.addLog(
            name,
            `Command '${command}' not found. Is it installed?`,
            color
          );
        }
      });

      proc.on("exit", (code, signal) => {
        if (code !== null) {
          this.addLog(name, `Process exited with code ${code}`, color);
        } else if (signal !== null) {
          this.addLog(name, `Process killed with signal ${signal}`, color);
        }
      });

      // Check if process started successfully
      setTimeout(() => {
        if (!proc.killed && proc.exitCode === null) {
          this.addLog(name, `Process started with PID ${proc.pid}`, color);
        }
      }, 100);
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
}

// Run CLI directly
program
  .name("sinfonia")
  .description("Run multiple commands in parallel with interactive filtering")
  .version("1.0.0")
  .argument("<commands...>", "Commands to run (format: NAME=COMMAND)")
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
  .action((commands: string[], options) => {
    const colors = options.color
      .split(",")
      .map((c: string) => `\x1b[${getColorCode(c)}m`);

    const parsedCommands: Command[] = commands.map((cmd, i) => {
      const [name, ...cmdParts] = cmd.split("=");
      return {
        name: name.toUpperCase(),
        cmd: cmdParts.join("="),
        color: colors[i % colors.length],
      };
    });

    const bufferSize = parseInt(options.bufferSize, 10);
    if (isNaN(bufferSize) || bufferSize < 1) {
      console.error("Buffer size must be a positive number");
      process.exit(1);
    }

    console.log("Starting processes...");
    const manager = new ProcessManager(parsedCommands, bufferSize);
    manager.start();
  });

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
