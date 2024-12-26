import { type ChildProcess, spawn } from "node:child_process";
import type { Command, Group, Processes } from "../types/index.js";
import { setupProcessHandlers } from "./handlers.js";

export interface ProcessState {
  processes: Processes;
  processStates: { [key: string]: "running" | "stopped" };
  processReady: { [key: string]: boolean };
  dependencyReady: { [key: string]: { [dep: string]: boolean } };
  pendingProcesses: Set<string>;
}

export class LifecycleManager {
  constructor(
    private state: ProcessState,
    private commands: Command[],
    private addLog: (name: string, data: string, color: string) => void
  ) {}

  private async startProcess(name: string): Promise<void> {
    const command = this.commands.find((cmd) => cmd.name === name);
    if (!command) return;

    if (command.dependsOn?.length) {
      const unreadyDeps = command.dependsOn.filter((dep) => {
        const hasReadyPattern = !!command.readyPatterns?.[dep.toLowerCase()];
        const isProcessRunning = this.state.processStates[dep] === "running";
        const hasSeenPattern = this.state.dependencyReady[name]?.[dep.toLowerCase()];

        if (hasReadyPattern) {
          return !isProcessRunning || !hasSeenPattern;
        }
        return !isProcessRunning;
      });

      if (unreadyDeps.length > 0) {
        this.state.pendingProcesses.add(name);
        this.addLog(name, `Waiting for dependencies: ${unreadyDeps.join(", ")}`, command.color);
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

    this.state.processes[name] = proc;
    this.state.processStates[name] = "running";

    setupProcessHandlers(proc, {
      name,
      color: command.color,
      addLog: this.addLog,
      processStates: this.state.processStates,
      dependencyReady: this.state.dependencyReady,
      commands: this.commands,
      startPendingProcesses: this.startPendingProcesses.bind(this),
    });
  }

  private async startPendingProcesses(): Promise<void> {
    for (const name of this.state.pendingProcesses) {
      const command = this.commands.find((cmd) => cmd.name === name);
      if (!command) continue;

      const unreadyDeps = command.dependsOn?.filter((dep) => {
        const hasReadyPattern = !!command.readyPatterns?.[dep.toLowerCase()];
        const isProcessRunning = this.state.processStates[dep] === "running";
        const hasSeenPattern = this.state.dependencyReady[name]?.[dep.toLowerCase()];

        if (hasReadyPattern && (!isProcessRunning || !hasSeenPattern)) {
          return true;
        }
        return !isProcessRunning;
      });

      if (!unreadyDeps?.length) {
        this.state.pendingProcesses.delete(name);
        await this.startProcess(name);
      }
    }
  }

  async toggleProcess(name: string): Promise<void> {
    if (!this.state.processes[name]) return;

    if (this.state.processStates[name] === "running") {
      this.state.processes[name].kill();
      this.state.processStates[name] = "stopped";
      this.addLog(name, "Process stopped", this.commands.find((c) => c.name === name)?.color || "");
    } else {
      await this.startProcess(name);
      this.addLog(name, "Process started", this.commands.find((c) => c.name === name)?.color || "");
    }
  }

  async restartProcess(name: string): Promise<void> {
    if (!this.state.processes[name]) return;

    this.state.processes[name].kill();
    await this.startProcess(name);
    this.addLog(name, "Process restarted", this.commands.find((c) => c.name === name)?.color || "");
  }

  sortCommandsByDependencies(): Command[] {
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

  cleanup(): void {
    Object.entries(this.state.processes).forEach(([name, proc]) => {
      try {
        proc.kill("SIGTERM");
        this.state.processStates[name] = "stopped";
      } catch (_e) {
        // Ignore errors during cleanup
      }
    });
  }

  public getProcessState(name: string): "running" | "stopped" {
    return this.state.processStates[name];
  }

  public getProcessStates(): { [key: string]: "running" | "stopped" } {
    return this.state.processStates;
  }

  public async startProcessPublic(name: string): Promise<void> {
    return this.startProcess(name);
  }
}
