import type { ChildProcess } from "node:child_process";
import type { Command } from "../types/index.js";

export interface ProcessHandlerContext {
  name: string;
  color: string;
  addLog: (name: string, data: string, color: string) => void;
  processStates: { [key: string]: "running" | "stopped" };
  dependencyReady: { [key: string]: { [dep: string]: boolean } };
  commands: Command[];
  startPendingProcesses: () => Promise<void>;
}

export function setupProcessHandlers(proc: ChildProcess, context: ProcessHandlerContext): void {
  const { name, color, addLog, processStates, dependencyReady, commands, startPendingProcesses } =
    context;

  proc.stdout?.on("data", (data: Buffer) => {
    const logData = data.toString();
    addLog(name, logData, color);

    commands.forEach((waitingCmd) => {
      if (waitingCmd.dependsOn?.includes(name) && waitingCmd.readyPatterns?.[name.toLowerCase()]) {
        const pattern = new RegExp(waitingCmd.readyPatterns[name.toLowerCase()]);
        if (pattern.test(logData)) {
          dependencyReady[waitingCmd.name] = dependencyReady[waitingCmd.name] || {};
          dependencyReady[waitingCmd.name][name.toLowerCase()] = true;
          startPendingProcesses();
        }
      }
    });
  });

  proc.stderr?.on("data", (data: Buffer) => {
    const logData = data.toString();
    addLog(name, logData, color);
  });

  proc.on("error", (error: Error) => {
    addLog(name, `Process error: ${error.message}`, color);
    processStates[name] = "stopped";
  });

  proc.on("exit", (code: number | null, signal: string | null) => {
    if (code !== null) {
      addLog(name, `Process exited with code ${code}`, color);
    } else if (signal !== null) {
      addLog(name, `Process killed with signal ${signal}`, color);
    }
    processStates[name] = "stopped";

    // Reset dependency ready states for processes waiting on us
    commands.forEach((cmd) => {
      if (cmd.dependsOn?.includes(name)) {
        if (dependencyReady[cmd.name]) {
          dependencyReady[cmd.name][name.toLowerCase()] = false;
        }
      }
    });
  });
}
