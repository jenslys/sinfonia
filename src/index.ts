#!/usr/bin/env bun
import { spawn } from "child_process";
import readline from "readline";
import { Command, Processes } from "./types/index.js";
import { program } from "commander";

const PANEL_WIDTH = 30;

export class ProcessManager {
  private currentFilter: string | null = null;
  private currentLogLine = 1;
  private processes: Processes = {};
  private commands: Command[];

  constructor(commands: Command[]) {
    this.commands = commands;
  }

  // For testing purposes
  public setFilter(name: string | null): void {
    this.currentFilter = name;
    this.clearScreen();
    this.drawControlPanel();
  }

  private clearScreen(): void {
    process.stdout.write("\x1bc");
    this.currentLogLine = 1;
  }

  private drawControlPanel(): void {
    const terminalHeight = process.stdout.rows || 24;

    for (let i = 0; i < terminalHeight - 1; i++) {
      process.stdout.write(`\x1B[${i + 1};${PANEL_WIDTH}H│`);
    }

    process.stdout.write(`\x1B[1;1H\x1b[7m Controls \x1b[0m`);
    process.stdout.write(`\x1B[3;2H[↑/↓] Filter Output`);
    process.stdout.write(`\x1B[4;2H[Ctrl+C] Exit`);

    process.stdout.write(`\x1B[6;1H\x1b[7m Available Filters \x1b[0m`);

    const isAllSelected = this.currentFilter === null;
    process.stdout.write(
      `\x1B[8;2H${isAllSelected ? "▶ " : "  "}\x1b[37m${
        isAllSelected ? "\x1b[7m" : ""
      }ALL\x1b[0m`
    );

    this.commands.forEach(({ name, color }, index) => {
      const isSelected = this.currentFilter === name;
      const prefix = isSelected ? "▶ " : "  ";
      const format = isSelected ? `${color}\x1b[7m` : color;
      process.stdout.write(
        `\x1B[${9 + index};2H${prefix}${format}${name}\x1b[0m`
      );
    });
  }

  private writeLog(data: string): void {
    if (this.currentLogLine >= (process.stdout.rows || 24) - 1) {
      this.currentLogLine = 1;
    }

    const maxWidth = (process.stdout.columns || 80) - PANEL_WIDTH - 2;
    const lines = data.toString().split("\n");

    lines.forEach((line) => {
      if (line.length > 0) {
        const truncatedLine = line.slice(0, maxWidth);
        process.stdout.write(`\x1B[s`);
        process.stdout.write(
          `\x1B[${this.currentLogLine};${PANEL_WIDTH + 2}H${truncatedLine}`
        );
        process.stdout.write(`\x1B[u`);
        this.currentLogLine++;
      }
    });

    this.drawControlPanel();
  }

  public start(): void {
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) process.stdin.setRawMode(true);

    process.stdout.on("resize", () => {
      this.clearScreen();
      this.drawControlPanel();
    });

    process.stdin.on("keypress", (str, key) => {
      if (key.ctrl && key.name === "c") {
        Object.values(this.processes).forEach((proc) => {
          proc.kill("SIGTERM");
        });
        process.exit();
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

        this.clearScreen();
        this.drawControlPanel();
      }
    });

    this.commands.forEach(({ name, cmd, color }) => {
      const [command, ...args] = cmd.split(" ");
      const proc = spawn(command, args, { shell: true });
      this.processes[name] = proc;

      proc.stdout?.on("data", (data) => {
        if (!this.currentFilter || this.currentFilter === name) {
          this.writeLog(`${color}[${name}]\x1b[0m ${data}`);
        }
      });

      proc.stderr?.on("data", (data) => {
        if (!this.currentFilter || this.currentFilter === name) {
          this.writeLog(`${color}[${name}]\x1b[0m ${data}`);
        }
      });
    });

    process.on("SIGINT", () => {
      Object.values(this.processes).forEach((proc) => {
        proc.kill("SIGTERM");
      });
      process.exit();
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

    console.log("Starting processes...");
    const manager = new ProcessManager(parsedCommands);
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
