import readline from "node:readline";
import type { Command, Group, Processes } from "../types/index.js";
import { setupKeyboardHandlers } from "../ui/keyboard.js";
import { clearScreen, drawControlPanel, hideCursor, showCursor } from "../ui/screen.js";
import { LifecycleManager, type ProcessState } from "./lifecycle.js";
import { LogManager, type LogState } from "./logs.js";
import { SearchManager, type SearchState } from "./search.js";

export class ProcessManager {
  private currentLogLine = 1;
  private isCleaningUp = false;
  private isUpdating = false;

  private logManager: LogManager;
  private searchManager: SearchManager;
  private lifecycleManager: LifecycleManager;

  constructor(
    private commands: Command[],
    private groups: Group[] = [],
    maxLogsPerProcess = 100,
    logFile: string | null = null
  ) {
    const logState: LogState = {
      logBuffers: {},
      maxLogsPerProcess,
      logFile,
      logQueue: [],
      isWritingLogs: false,
      logFlushInterval: null,
      logPromiseQueue: Promise.resolve(),
    };

    const searchState: SearchState = {
      searchMode: false,
      searchText: "",
      searchBuffer: "",
      currentFilter: null,
    };

    const processState: ProcessState = {
      processes: {},
      processStates: {},
      processReady: {},
      dependencyReady: {},
      pendingProcesses: new Set(),
    };

    commands.forEach(({ name }) => {
      logState.logBuffers[name] = [];
      processState.processStates[name] = "running";
    });

    if (logFile) {
      logState.logFlushInterval = setInterval(() => {
        logState.logPromiseQueue = logState.logPromiseQueue.then(() => this.logManager.flushLogs());
      }, 1000);
    }

    this.logManager = new LogManager(logState);
    this.searchManager = new SearchManager(searchState, commands, groups, () =>
      this.updateScreen()
    );
    this.lifecycleManager = new LifecycleManager(processState, commands, (name, data, color) => {
      this.logManager.addLog(name, data, color);
      if (
        !this.isUpdating &&
        (!searchState.currentFilter ||
          searchState.currentFilter === name ||
          (searchState.currentFilter.startsWith("group:") &&
            groups.find(
              (g) => `group:${g.name}` === searchState.currentFilter && g.commands.includes(name)
            )))
      ) {
        this.updateScreen();
      }
    });
  }

  public isSearchMode(): boolean {
    return this.searchManager.isSearchMode();
  }

  public getCurrentFilter(): string | null {
    return this.searchManager.getCurrentFilter();
  }

  public submitSearch(): void {
    this.searchManager.submitSearch();
  }

  public updateSearchBuffer(updater: (prev: string) => string): void {
    this.searchManager.updateSearchBuffer(updater);
  }

  public navigateFilter(direction: "up" | "down"): void {
    this.searchManager.navigateFilter(direction);
  }

  public toggleSearch(): void {
    this.searchManager.toggleSearch();
  }

  public async toggleProcess(name: string): Promise<void> {
    await this.lifecycleManager.toggleProcess(name);
    this.updateScreen();
  }

  public async restartProcess(name: string): Promise<void> {
    await this.lifecycleManager.restartProcess(name);
    this.updateScreen();
  }

  public async toggleGroup(groupName: string): Promise<void> {
    const group = this.groups.find((g) => g.name === groupName);
    if (!group) return;

    const allRunning = group.commands.every(
      (cmd) => this.lifecycleManager.getProcessState(cmd) === "running"
    );

    for (const cmdName of group.commands) {
      if (allRunning) {
        await this.lifecycleManager.toggleProcess(cmdName);
      } else if (this.lifecycleManager.getProcessState(cmdName) === "stopped") {
        await this.lifecycleManager.toggleProcess(cmdName);
      }
    }
    this.updateScreen();
  }

  public async restartGroup(groupName: string): Promise<void> {
    const group = this.groups.find((g) => g.name === groupName);
    if (!group) return;

    for (const cmdName of group.commands) {
      await this.lifecycleManager.restartProcess(cmdName);
    }
    this.updateScreen();
  }

  private updateScreen(): void {
    if (this.isUpdating || this.isCleaningUp) return;
    this.isUpdating = true;

    try {
      clearScreen();
      drawControlPanel(
        this.commands,
        this.groups,
        this.searchManager.getCurrentFilter(),
        this.lifecycleManager.getProcessStates(),
        this.searchManager.isSearchMode(),
        this.searchManager.getSearchBuffer(),
        this.searchManager.getSearchText()
      );
      this.currentLogLine = 1;

      let logs = this.logManager.getAllLogs();

      // Filter by current filter first
      const currentFilter = this.searchManager.getCurrentFilter();
      if (currentFilter) {
        if (currentFilter.startsWith("group:")) {
          const groupName = currentFilter.replace("group:", "");
          const group = this.groups.find((g) => g.name === groupName);
          if (group) {
            logs = logs.filter((log) => group.commands.includes(log.name));
          }
        } else {
          logs = logs.filter((log) => log.name === currentFilter);
        }
      }

      // Then apply search text filter
      logs = this.searchManager.filterLogs(logs);

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

    const maxWidth = Math.max(10, (process.stdout.columns || 80) - 30 - 2);
    const lines = data.toString().split("\n");

    lines.forEach((line) => {
      if (line.length > 0) {
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

        while (pos < line.length && inEscSeq) {
          if (/[a-zA-Z]/.test(line[pos])) {
            pos++;
            break;
          }
          pos++;
        }

        const truncatedLine = line.slice(0, pos);
        process.stdout.write(`\x1B[${this.currentLogLine};32H${truncatedLine}`);
        this.currentLogLine++;
      }
    });
  }

  public cleanup(): void {
    if (this.isCleaningUp) return;
    this.isCleaningUp = true;

    try {
      this.logManager.cleanup();
      this.lifecycleManager.cleanup();

      showCursor();
      process.stdout.write("\x1B[2J"); // Clear screen
      process.stdout.write("\x1B[3J"); // Clear scrollback
      process.stdout.write("\x1B[H"); // Move to home
      process.stdout.write("\x1B[0m"); // Reset all attributes
      process.stdout.write("\x1B[!p"); // Soft reset terminal
      process.stdout.write("\x1Bc"); // Full reset

      const allLogs = this.logManager.getAllLogs();

      console.log();
      allLogs.forEach((log) => {
        const cleanData = log.data.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "").trimEnd();
        console.log(`[${log.name}] ${cleanData}`);
      });
      console.log();
    } catch (_e) {
      console.error("Error during cleanup:", _e);
    } finally {
      process.exit(0);
    }
  }

  public start(): void {
    const enableRawMode = () => {
      try {
        if (process.stdin.isTTY) {
          readline.emitKeypressEvents(process.stdin);
          process.stdin.setRawMode(true);
          process.stdin.resume();
        }
      } catch (_e) {
        console.error("Failed to set raw mode");
        process.exit(1);
      }
    };

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
    hideCursor();
    setupKeyboardHandlers(this);

    let resizeTimeout: ReturnType<typeof setTimeout>;
    process.stdout.on("resize", () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this.updateScreen();
      }, 100);
    });

    const sortedCommands = this.lifecycleManager.sortCommandsByDependencies();
    sortedCommands.forEach(({ name }) => {
      this.lifecycleManager.startProcessPublic(name);
    });

    clearScreen();
    this.updateScreen();
  }

  public setFilter(name: string | null): void {
    this.searchManager.setFilter(name);
  }
}
