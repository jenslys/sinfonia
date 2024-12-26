#!/usr/bin/env bun
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { program } from "commander";
import { ProcessManager } from "./process/manager.js";
import type { Command, Config, ConfigFile, Group } from "./types/index.js";
import { ANSI_COLORS, getColorCode } from "./utils/colors.js";
import { formatLogPath } from "./utils/time.js";

program
  .name("sinfonia")
  .description("Run multiple commands in parallel with interactive filtering")
  .version("1.0.0");

program
  .command("init")
  .description("Generate a starter config file")
  .option("-f, --force", "Overwrite existing config file")
  .action((options) => {
    const configPath = path.resolve(process.cwd(), "sinfonia.json");
    if (existsSync(configPath) && !options.force) {
      console.error("Config file already exists. Use --force to overwrite.");
      process.exit(1);
    }

    try {
      const starterConfigPath = path.join(__dirname, "../starter.config.json");
      const starterConfig = readFileSync(starterConfigPath, "utf-8");
      writeFileSync(configPath, starterConfig);
      console.log(`Created config file at ${configPath}`);
    } catch (error) {
      console.error(`Failed to create config file: ${error}`);
      process.exit(1);
    }
  });

program
  .command("start", { isDefault: true })
  .description("Start processes")
  .option("-c, --config <file>", "Path to config file", "sinfonia.json")
  .option("-l, --log-file [file]", "Enable logging to file (use {timestamp} for current date/time)")
  .option("-b, --buffer-size <size>", "Number of log lines to keep in memory per process", "100")
  .argument("[commands...]", "Simple commands to run (format: [GROUP:]NAME=COMMAND)")
  .action((commands: string[], options) => {
    let config: Config;

    if (options.config && existsSync(options.config)) {
      try {
        const configPath = path.resolve(process.cwd(), options.config);
        const configContent = readFileSync(configPath, "utf-8");
        const parsedConfig: ConfigFile = JSON.parse(configContent);

        // Ensure all commands have colors
        let colorIndex = 0;

        const commandsWithColors: Command[] = parsedConfig.commands.map((cmd) => ({
          ...cmd,
          color: cmd.color
            ? `\x1b[${getColorCode(cmd.color)}m`
            : ANSI_COLORS[colorIndex++ % ANSI_COLORS.length],
        }));

        // Auto-generate groups from commands while respecting explicit group definitions
        const autoGroups = new Map<string, Group>();

        // First collect all groups from commands
        commandsWithColors.forEach((cmd) => {
          if (cmd.group && !autoGroups.has(cmd.group)) {
            autoGroups.set(cmd.group, {
              name: cmd.group,
              color: ANSI_COLORS[colorIndex++ % ANSI_COLORS.length],
              commands: [],
            });
          }
          if (cmd.group) {
            autoGroups.get(cmd.group)?.commands.push(cmd.name);
          }
        });

        // Then override with any explicit group definitions
        const groupsWithColors: Group[] =
          parsedConfig.groups?.map((group) => ({
            ...group,
            color: group.color
              ? `\x1b[${getColorCode(group.color)}m`
              : autoGroups.get(group.name)?.color || ANSI_COLORS[colorIndex++ % ANSI_COLORS.length],
          })) || Array.from(autoGroups.values());

        config = {
          commands: commandsWithColors,
          groups: groupsWithColors,
          options: {
            bufferSize: Number.parseInt(options.bufferSize, 10),
            logFile: options.logFile,
          },
        };
      } catch (_e) {
        console.error(`Failed to read config file: ${_e}`);
        process.exit(1);
      }
    } else if (commands.length === 0) {
      console.error("No commands specified and no config file found.");
      console.log("Run 'sinfonia init' to create a starter config file.");
      process.exit(1);
    } else {
      // Parse simple commands
      const groups: Group[] = [];
      const parsedCommands: Command[] = [];
      let colorIndex = 0;

      commands.forEach((cmd) => {
        const [nameWithGroup, command] = cmd.split("=");
        const [groupName, name] = nameWithGroup.includes(":")
          ? nameWithGroup.split(":")
          : [undefined, nameWithGroup];

        if (groupName) {
          let group = groups.find((g) => g.name === groupName.toUpperCase());
          if (!group) {
            const color = ANSI_COLORS[colorIndex++ % ANSI_COLORS.length];
            group = {
              name: groupName.toUpperCase(),
              color,
              commands: [],
            };
            groups.push(group);
          }
          group.commands.push(name.toUpperCase());
        }

        parsedCommands.push({
          name: name.toUpperCase(),
          cmd: command,
          color: ANSI_COLORS[colorIndex++ % ANSI_COLORS.length],
          group: groupName?.toUpperCase(),
        });
      });

      config = {
        commands: parsedCommands,
        groups,
        options: {
          bufferSize: Number.parseInt(options.bufferSize, 10),
          logFile: options.logFile,
        },
      };
    }

    // Validate config
    if (!config.commands?.length) {
      console.error(
        "No commands specified. Use either a config file or provide commands directly."
      );
      process.exit(1);
    }

    const bufferSize = config.options?.bufferSize || Number.parseInt(options.bufferSize, 10);
    if (Number.isNaN(bufferSize) || bufferSize < 1) {
      console.error("Buffer size must be a positive number");
      process.exit(1);
    }

    // Format log file path if logging is enabled
    const logFile = options.logFile
      ? formatLogPath(options.logFile)
      : config.options?.logFile
        ? formatLogPath(config.options.logFile)
        : null;

    console.log("Starting processes...");
    const manager = new ProcessManager(config.commands, config.groups || [], bufferSize, logFile);
    manager.start();
  });

program.parse();
