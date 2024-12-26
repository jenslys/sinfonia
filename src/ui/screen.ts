import type { Command, Group } from "../types/index.js";

export const PANEL_WIDTH = 30;

export function hideCursor(): void {
  process.stdout.write("\x1B[?25l");
}

export function showCursor(): void {
  process.stdout.write("\x1B[?25h");
}

export function clearScreen(): void {
  process.stdout.write("\x1bc");
}

export function drawControlPanel(
  commands: Command[],
  groups: Group[],
  currentFilter: string | null,
  processStates: { [key: string]: "running" | "stopped" },
  searchMode: boolean,
  searchBuffer: string,
  searchText: string
): void {
  const terminalHeight = process.stdout.rows || 24;

  for (let i = 0; i < terminalHeight - 1; i++) {
    process.stdout.write(`\x1B[${i + 1};${PANEL_WIDTH}H│`);
  }

  process.stdout.write(`\x1B[1;1H\x1b[7m Controls \x1b[0m`);
  process.stdout.write(`\x1B[3;2H[↑/↓] Filter Output`);
  process.stdout.write(`\x1B[4;2H[r] Restart Process/Group`);
  process.stdout.write(`\x1B[5;2H[s] Stop/Start`);
  process.stdout.write(`\x1B[6;2H[f] Search/Filter`);
  process.stdout.write(`\x1B[7;2H[Ctrl+C] Exit`);

  process.stdout.write(`\x1B[9;1H\x1b[7m Available Processes \x1b[0m`);

  const isAllSelected = currentFilter === null;
  process.stdout.write(
    `\x1B[11;2H${isAllSelected ? "▶ " : "  "}\x1b[37m${isAllSelected ? "\x1b[7m" : ""}ALL\x1b[0m`
  );

  let currentLine = 12;

  // Draw groups
  groups.forEach((group) => {
    const isSelected = currentFilter === `group:${group.name}`;
    const prefix = isSelected ? "▶ " : "  ";
    const format = isSelected ? `${group.color}\x1b[7m` : group.color;
    const allRunning = group.commands.every((cmd) => processStates[cmd] === "running");
    const allStopped = group.commands.every((cmd) => processStates[cmd] === "stopped");
    const stateIcon = allRunning ? "⚡" : allStopped ? "⏸" : "⚡⏸";

    process.stdout.write(
      `\x1B[${currentLine};2H${prefix}${format}${stateIcon} [${group.name}]\x1b[0m`
    );
    currentLine++;

    // Draw group members indented
    group.commands.forEach((cmdName) => {
      const cmd = commands.find((c) => c.name === cmdName);
      if (cmd) {
        const isSelected = currentFilter === cmdName;
        const prefix = isSelected ? "▶ " : "  ";
        const format = isSelected ? `${cmd.color}\x1b[7m` : cmd.color;
        const state = processStates[cmdName];
        const stateIcon = state === "running" ? "⚡" : "⏸";

        process.stdout.write(
          `\x1B[${currentLine};4H${prefix}${format}${stateIcon} ${cmdName}\x1b[0m`
        );
        currentLine++;
      }
    });
  });

  // Draw ungrouped commands
  const ungroupedCommands = commands.filter((cmd) => !cmd.group);
  ungroupedCommands.forEach(({ name, color }) => {
    const isSelected = currentFilter === name;
    const prefix = isSelected ? "▶ " : "  ";
    const format = isSelected ? `${color}\x1b[7m` : color;
    const state = processStates[name];
    const stateIcon = state === "running" ? "⚡" : "⏸";

    process.stdout.write(`\x1B[${currentLine};2H${prefix}${format}${stateIcon} ${name}\x1b[0m`);
    currentLine++;
  });

  drawSearchBox(searchMode, searchBuffer, searchText);
}

function drawSearchBox(searchMode: boolean, searchBuffer: string, searchText: string): void {
  if (searchMode) {
    const searchPrompt = "Search: ";
    const searchY = process.stdout.rows - 4;

    process.stdout.write(`\x1B[${searchY};2H┌${"─".repeat(PANEL_WIDTH - 4)}┐`);
    process.stdout.write(
      `\x1B[${searchY + 1};2H│ ${searchPrompt}${searchBuffer}${" ".repeat(
        PANEL_WIDTH - 4 - searchPrompt.length - searchBuffer.length - 2
      )} │`
    );
    process.stdout.write(`\x1B[${searchY + 2};2H└${"─".repeat(PANEL_WIDTH - 4)}┘`);
    process.stdout.write(`\x1B[${searchY + 3};2H\x1b[90m[Enter] Submit · [Esc] Cancel\x1b[0m`);

    process.stdout.write(`\x1B[${searchY + 1};${4 + searchPrompt.length + searchBuffer.length}H`);
  }

  if (searchText) {
    const filterY = process.stdout.rows - 5;
    process.stdout.write(`\x1B[${filterY};2H\x1b[33mFilter: ${searchText}\x1b[0m`);
  }
}
