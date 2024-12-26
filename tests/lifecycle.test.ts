import { beforeEach, describe, expect, test } from "bun:test";
import { LifecycleManager, type ProcessState } from "../src/process/lifecycle.js";
import type { Command } from "../src/types/index.js";

describe("Lifecycle", () => {
  let lifecycleManager: LifecycleManager;
  let state: ProcessState;
  let logs: { name: string; data: string; color: string }[] = [];

  const mockCommands: Command[] = [
    {
      name: "test1",
      cmd: "echo test1",
      color: "\x1b[34m",
      dependsOn: ["test2"],
      readyPatterns: {
        test2: "ready",
      },
    },
    {
      name: "test2",
      cmd: "echo test2",
      color: "\x1b[32m",
    },
    {
      name: "test3",
      cmd: "echo test3",
      color: "\x1b[33m",
      dependsOn: ["test1"],
    },
    {
      name: "test4",
      cmd: "invalid_command",
      color: "\x1b[35m",
    },
  ];

  beforeEach(() => {
    logs = [];
    state = {
      processes: {},
      processStates: {},
      processReady: {},
      dependencyReady: {},
      pendingProcesses: new Set(),
    };

    lifecycleManager = new LifecycleManager(state, mockCommands, (name, data, color) => {
      logs.push({ name, data, color });
    });
  });

  test("should start process", async () => {
    await lifecycleManager.startProcessPublic("test2");
    expect(state.processStates.test2).toBe("running");
  });

  test("should handle dependencies", async () => {
    await lifecycleManager.startProcessPublic("test1");
    expect(state.pendingProcesses.has("test1")).toBe(true);
    expect(logs[0].data).toContain("Waiting for dependencies");
  });

  test("should toggle process", async () => {
    await lifecycleManager.startProcessPublic("test2");
    expect(state.processStates.test2).toBe("running");

    await lifecycleManager.toggleProcess("test2");
    expect(state.processStates.test2).toBe("stopped");

    await lifecycleManager.toggleProcess("test2");
    expect(state.processStates.test2).toBe("running");
  });

  test("should restart process", async () => {
    await lifecycleManager.startProcessPublic("test2");
    const originalPid = state.processes.test2.pid;

    await lifecycleManager.restartProcess("test2");
    expect(state.processes.test2.pid).not.toBe(originalPid);
    expect(state.processStates.test2).toBe("running");
  });

  test("should sort by dependencies", () => {
    const sorted = lifecycleManager.sortCommandsByDependencies();
    expect(sorted[0].name).toBe("test2");
    expect(sorted[1].name).toBe("test1");
  });

  test("should cleanup processes", async () => {
    await lifecycleManager.startProcessPublic("test2");
    expect(state.processes.test2).toBeDefined();

    lifecycleManager.cleanup();
    expect(state.processStates.test2).toBe("stopped");
  });

  test("should handle dependency chain", async () => {
    // test3 depends on test1 which depends on test2
    await lifecycleManager.startProcessPublic("test3");
    expect(state.pendingProcesses.has("test3")).toBe(true);
    expect(logs[0].data).toContain("Waiting for dependencies");

    // Start test2 (base dependency)
    await lifecycleManager.startProcessPublic("test2");
    expect(state.processStates.test2).toBe("running");

    // Simulate test2 ready pattern
    state.dependencyReady.test1 = { test2: true };
    await lifecycleManager.startProcessPublic("test1");
    expect(state.processStates.test1).toBe("running");
  });

  test("should handle process errors", async () => {
    await lifecycleManager.startProcessPublic("test4");

    // Wait for process to fail and error to be logged
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Check process state
    expect(state.processStates.test4).toBe("stopped");

    // Check error logs
    const errorLogs = logs.filter(
      (log) =>
        log.name === "test4" &&
        (log.data.includes("error") || log.data.includes("Error") || log.data.includes("exited"))
    );
    expect(errorLogs.length).toBeGreaterThan(0);
  });

  test("should handle missing dependencies", async () => {
    const commandsWithMissingDep: Command[] = [
      {
        name: "test5",
        cmd: "echo test5",
        color: "\x1b[36m",
        dependsOn: ["nonexistent"],
      },
    ];

    const newState: ProcessState = {
      processes: {},
      processStates: {},
      processReady: {},
      dependencyReady: {},
      pendingProcesses: new Set<string>(),
    };

    const managerWithMissingDep = new LifecycleManager(
      newState,
      commandsWithMissingDep,
      (name, data, color) => {
        logs.push({ name, data, color });
      }
    );

    await managerWithMissingDep.startProcessPublic("test5");
    expect(newState.pendingProcesses.has("test5")).toBe(true);
    expect(
      logs.some((log) => log.name === "test5" && log.data.includes("Waiting for dependencies"))
    ).toBe(true);
  });

  test("should handle ready patterns", async () => {
    await lifecycleManager.startProcessPublic("test2");
    expect(state.processStates.test2).toBe("running");

    // Start dependent process
    await lifecycleManager.startProcessPublic("test1");
    expect(state.pendingProcesses.has("test1")).toBe(true);

    // Simulate ready pattern match
    state.dependencyReady.test1 = { test2: true };
    await lifecycleManager.startProcessPublic("test1");
    expect(state.processStates.test1).toBe("running");
  });
});
