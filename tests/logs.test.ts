import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { file } from "bun";
import { LogManager, type LogState } from "../src/process/logs.js";
import { ProcessManager } from "../src/process/manager.js";

describe("Logs", () => {
  let logManager: LogManager;
  let state: LogState;
  const testLogFile = join(process.cwd(), "test.log");

  beforeEach(() => {
    if (existsSync(testLogFile)) {
      unlinkSync(testLogFile);
    }
    // Create empty file with write permissions
    writeFileSync(testLogFile, "");

    state = {
      logBuffers: {
        test1: [],
        test2: [],
      },
      maxLogsPerProcess: 2,
      logFile: testLogFile,
      logQueue: [],
      isWritingLogs: false,
      logFlushInterval: null,
      logPromiseQueue: Promise.resolve(),
    };

    logManager = new LogManager(state);
  });

  afterEach(() => {
    try {
      // Ensure we have permissions to delete
      if (existsSync(testLogFile)) {
        chmodSync(testLogFile, 0o666);
        unlinkSync(testLogFile);
      }
    } catch (error) {
      console.error("Failed to cleanup test file:", error);
    }
  });

  test("should add logs to buffer", () => {
    logManager.addLog("test1", "hello", "\x1b[34m");
    expect(state.logBuffers.test1).toHaveLength(1);
    expect(state.logBuffers.test1[0].data).toBe("hello");
  });

  test("should respect max logs per process", () => {
    logManager.addLog("test1", "first", "\x1b[34m");
    logManager.addLog("test1", "second", "\x1b[34m");
    logManager.addLog("test1", "third", "\x1b[34m");

    expect(state.logBuffers.test1).toHaveLength(2);
    expect(state.logBuffers.test1[0].data).toBe("second");
    expect(state.logBuffers.test1[1].data).toBe("third");
  });

  test("should write logs to file", async () => {
    logManager.addLog("test1", "hello", "\x1b[34m");
    await logManager.flushLogs();

    const fileContents = await file(testLogFile).text();
    expect(fileContents).toContain("[test1] hello");
  });

  test("should get all logs sorted by timestamp", () => {
    logManager.addLog("test1", "first", "\x1b[34m");
    logManager.addLog("test2", "second", "\x1b[32m");

    const allLogs = logManager.getAllLogs();
    expect(allLogs).toHaveLength(2);
    expect(allLogs[0].data).toBe("first");
    expect(allLogs[1].data).toBe("second");
  });

  test("should handle file write errors", async () => {
    // Verify initial state
    expect(state.logFile).toBe(testLogFile);
    expect(existsSync(testLogFile)).toBe(true);

    // Make log file read-only
    chmodSync(testLogFile, 0o444);

    // Try to write to the read-only file
    logManager.addLog("test1", "hello", "\x1b[34m");
    await logManager.flushLogs();

    // Verify that file logging was disabled
    expect(state.logFile).toBeNull();
    expect(state.logFlushInterval).toBeNull();

    // Verify that in-memory logging still works
    expect(state.logBuffers.test1).toHaveLength(1);
    expect(state.logBuffers.test1[0].data).toBe("hello");

    // Verify that subsequent writes don't throw
    expect(() => {
      logManager.addLog("test1", "world", "\x1b[34m");
    }).not.toThrow();
  });

  test("should cleanup properly", () => {
    state.logFlushInterval = setInterval(() => {}, 1000);
    logManager.cleanup();
    expect(state.logFlushInterval).toBeNull();
  });

  test("should strip ANSI colors from file output", async () => {
    const coloredText = "\x1b[34mcolored text\x1b[0m";
    logManager.addLog("test1", coloredText, "\x1b[34m");
    await logManager.flushLogs();

    const fileContents = await file(testLogFile).text();
    expect(fileContents).toContain("[test1] colored text");
    expect(fileContents).not.toContain("\x1b[34m");
  });

  test("should handle multiline logs", async () => {
    const multiline = "line1\nline2\nline3";
    logManager.addLog("test1", multiline, "\x1b[34m");
    await logManager.flushLogs();

    const fileContents = await file(testLogFile).text();
    expect(fileContents).toContain("line1");
    expect(fileContents).toContain("line2");
    expect(fileContents).toContain("line3");
  });

  test("should handle large log queues", async () => {
    // Add more than 1000 logs
    for (let i = 0; i < 1100; i++) {
      logManager.addLog("test1", `log ${i}`, "\x1b[34m");
    }

    await logManager.flushLogs();
    expect(state.logQueue).toHaveLength(0);
  });
});

describe("ProcessManager Logs", () => {
  test("should handle scrolling logs", () => {
    const manager = new ProcessManager([{ name: "TEST", cmd: "echo test", color: "\x1b[34m" }]);

    // Terminal height is 24 lines by default
    // 2 lines reserved for UI elements
    // So we can show max 22 lines of logs
    // Adding 30 logs ensures we have enough to scroll
    for (let i = 0; i < 30; i++) {
      manager["logManager"].addLog("TEST", `Log line ${i}`, "\x1b[34m");
    }

    // Initially should be in follow mode (showing last 22 lines)
    expect(manager["isFollowing"]).toBe(true);

    // Scroll up should disable follow mode
    manager.scrollLogs("up", 1);
    expect(manager["isFollowing"]).toBe(false);

    // Check scroll bounds
    manager.scrollLogs("up", 100); // Try to scroll past start
    expect(manager["scrollOffset"]).toBe(0);

    manager.scrollLogs("down", 100); // Try to scroll past end
    // maxScroll = totalLogs(30) - visibleLines(22) = 8
    const maxScroll = manager["logManager"].getAllLogs().length - ((process.stdout.rows || 24) - 2);
    expect(manager["scrollOffset"]).toBe(maxScroll);
  });

  test("should handle follow mode", () => {
    const manager = new ProcessManager([{ name: "TEST", cmd: "echo test", color: "\x1b[34m" }]);

    // Add initial logs
    for (let i = 0; i < 30; i++) {
      manager["logManager"].addLog("TEST", `Log line ${i}`, "\x1b[34m");
    }

    // Scroll up to disable follow
    manager.scrollLogs("up", 10);
    expect(manager["isFollowing"]).toBe(false);

    // Toggle follow back on
    manager.toggleFollow();
    expect(manager["isFollowing"]).toBe(true);

    // Should jump to latest logs
    const maxScroll = manager["logManager"].getAllLogs().length - ((process.stdout.rows || 24) - 2);
    expect(manager["scrollOffset"]).toBe(maxScroll);

    // Add more logs while following
    manager["logManager"].addLog("TEST", "New log line", "\x1b[34m");
    // Need to recalculate maxScroll after adding new log
    const newMaxScroll =
      manager["logManager"].getAllLogs().length - ((process.stdout.rows || 24) - 2);

    // Force an update to ensure scroll position is updated
    manager.toggleFollow();
    manager.toggleFollow();

    expect(manager["scrollOffset"]).toBe(newMaxScroll);
  });
});
