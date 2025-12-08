# sinfonia

A modern, interactive process manager for developers.

[![npm version](https://badge.fury.io/js/sinfonia.svg)](https://badge.fury.io/js/sinfonia)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

![Preview](https://github.com/user-attachments/assets/5fadbe2d-8a22-4c18-af7f-9f8455e73bfa)

> **sinfonia** _(n.)_ - from Italian, meaning "symphony": a harmonious combination of elements working together as one, just like an orchestra performing multiple parts in perfect coordination.

## Features

- **Parallel Execution:** Execute and monitor multiple commands concurrently in a single terminal session.
- **Process Grouping:** Organize related services (e.g., "frontend", "backend") for bulk control and isolated filtering.
- **Dependency Management:** Define start orders and wait conditions (e.g., wait for DB port) using a declarative configuration.
- **Interactive Filtering:** Focus on specific process or group outputs using arrow keys.
- **Real-time Search:** Search through logs and process names instantly.
- **Process Control:** Interactively start, stop, and restart individual processes or entire groups.
- **State Management:** Robust handling of process lifecycles and states.
- **Configurable Output:** Customize buffer sizes and log file paths.
- **JSON Schema:** Full IDE support with validation for configuration files.

## Installation

```bash
# Using bun
bun install -g sinfonia

# Using npm
npm install -g sinfonia

# Using yarn
yarn global add sinfonia
```

## Usage

Sinfonia supports both quick ad-hoc commands and robust declarative configurations.

### Ad-hoc Execution (CLI)

Perfect for simple usage without dependencies:

```bash
# Single command
sinfonia "web=npm run dev"

# Multiple commands
sinfonia "web=npm run dev" "api=npm run server"

# With groups
sinfonia "frontend:web=npm run dev" "backend:api=npm run server"
```

**CLI Features:**
- Basic command running (`name=cmd`)
- Basic grouping (`group:name=cmd`)
- Buffer size (`-b, --buffer-size`)
- Log file (`-l, --log-file`)
- Config file (`-c, --config`)

### Declarative Configuration (sinfonia.json)

For complex setups with dependencies, use a config file. You can generate a starter config with:

```bash
# Generate a starter config file (sinfonia.json)
sinfonia init

# Generate and overwrite existing config
sinfonia init --force
```

Then run it with:

```bash
# Uses sinfonia.json by default
sinfonia

# Or specify a different config file
sinfonia -c custom.json
```

**Config Mode Features:**
- All CLI features
- Dependencies between commands (`dependsOn`)
- Ready patterns for dependencies (`readyPatterns`)
- Per-command and per-group color customization
- Reusable configuration

Example config file (`sinfonia.json`):

```json
{
  "$schema": "https://raw.githubusercontent.com/jenslys/sinfonia/main/schema.json",
  "commands": [
    {
      "name": "DB",
      "cmd": "docker compose up",
      "color": "blue"
    },
    {
      "name": "API",
      "cmd": "npm run api",
      "group": "BACKEND",
      "dependsOn": ["DB"],
      "readyPatterns": {
        "db": "Database system is ready"
      }
    },
    {
      "name": "WORKER",
      "cmd": "npm run worker",
      "group": "BACKEND",
      "dependsOn": ["DB"],
      "readyPatterns": {
        "db": "Database system is ready"
      }
    },
    {
      "name": "WEB",
      "cmd": "npm run dev",
      "group": "FRONTEND",
      "dependsOn": ["API"],
      "readyPatterns": {
        "api": "Server started on port"
      }
    }
  ],
  "groups": [
    {
      "name": "BACKEND",
      "color": "cyan"
    },
    {
      "name": "FRONTEND",
      "color": "magenta"
    }
  ],
  "options": {
    "bufferSize": 100
  }
}
```

The config file supports JSON Schema validation for better IDE support and validation. Groups are automatically created from command `group` fields - you only need to define them in the `groups` array if you want to customize their properties (like colors).

### Options

```bash
# Custom buffer size
sinfonia -b 200 "web=npm run dev" "api=npm run server"

# Enable logging to file
sinfonia -l "output_{timestamp}.log" "web=npm run dev" "api=npm run server"

# Use custom config file (defaults to sinfonia.json)
sinfonia -c my-config.json
```

## Controls

| Key      | Action                |
|----------|----------------------|
| `↑/↓`    | Navigate processes/groups |
| `r`      | Restart process/group |
| `s`      | Stop/Start process/group |
| `f`      | Search in logs |
| `j/k`    | Scroll logs up/down |
| `u/d`    | Page up/down (half screen) |
| `Space`  | Toggle auto-follow logs |
| `Ctrl+C` | Exit all processes   |

### Log Navigation

The log viewer supports both manual and auto-follow modes:

- Use `j/k` for line-by-line scrolling
- Use `u/d` for faster page-based scrolling
- Press `Space` to toggle between manual scrolling and auto-follow mode
- Auto-follow mode automatically shows the latest logs as they arrive
- Any scroll action automatically switches to manual mode

## License

[MIT](LICENSE)
