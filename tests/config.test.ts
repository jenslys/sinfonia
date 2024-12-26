import { expect, test, describe } from "bun:test";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { file, spawn } from "bun";

describe("Config", () => {
  const configPath = path.resolve(process.cwd(), "sinfonia.json");

  test("should create config file with init command", async () => {
    // Clean up any existing test config
    if (existsSync(configPath)) {
      unlinkSync(configPath);
    }

    const proc = spawn(["bun", "run", "src/cli.ts", "init", "-f"], {
      stdout: "pipe",
      stderr: "pipe",
      cwd: process.cwd(),
      env: { ...process.env, NO_COLOR: "1" },
    });

    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    await proc.exited;

    if (proc.exitCode !== 0) {
      console.error("Init command failed:", stderr);
    }

    expect(proc.exitCode).toBe(0);
    expect(stdout).toContain("Created config file");
    expect(existsSync(configPath)).toBe(true);

    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(config).toHaveProperty("commands");

    // Cleanup
    unlinkSync(configPath);
  });

  test("should parse command line arguments", async () => {
    const proc = spawn(["bun", "run", "src/cli.ts", "-c", "tests/test.config.json"], {
      stdout: "pipe",
      stderr: "pipe",
      cwd: process.cwd(),
      env: { ...process.env, NO_COLOR: "1" },
    });

    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    await proc.exited;

    if (proc.exitCode !== 0) {
      console.error("Command failed:", stderr);
    }

    expect(proc.exitCode).toBe(0);
    expect(stdout).toContain("Starting processes...");
    expect(stdout).toContain("[BASE] Base service ready");
    expect(stdout).toContain("[DEPENDENT] Dependent service starting...");
    expect(stdout).toContain("[NESTED] Nested service starting...");
  });

  test("should validate config file", async () => {
    const proc = spawn(["bun", "run", "src/cli.ts", "-c", "invalid.json"], {
      stdout: "pipe",
      stderr: "pipe",
      cwd: process.cwd(),
      env: { ...process.env, NO_COLOR: "1" },
    });

    const stderr = await new Response(proc.stderr).text();
    await proc.exited;

    expect(proc.exitCode).toBe(1);
    expect(stderr).toContain("No commands specified and no config file found");
  });
});
