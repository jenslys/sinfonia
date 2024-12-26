import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { file } from "bun";
import { LogManager, type LogState } from "../src/process/logs.js";

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
