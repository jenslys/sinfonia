# sinfonia 🎵

A beautiful process runner for parallel commands with interactive filtering and real-time output control.

[![npm version](https://badge.fury.io/js/sinfonia.svg)](https://badge.fury.io/js/sinfonia)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

> **sinfonia** _(n.)_ - from Italian, meaning "symphony": a harmonious combination of elements working together as one, just like an orchestra performing multiple parts in perfect coordination.

## Features ✨

- 🚀 Run multiple commands in parallel with a single terminal window
- 👥 Group related processes for better organization
- 🎯 Filter and focus on specific process or group outputs using arrow keys
- 🎨 Search through logs and process names in real-time
- 🎨 Color-coded outputs for easy process identification
- ⌨️ Interactive process/group control (start/stop/restart)
- 📊 Real-time output monitoring
- 🔄 Process state management
- 💾 Configurable output buffer size
- 🔗 Optional dependency ordering with ready state detection (via config file)
- 📝 Automatic log file generation with customizable paths
- 📋 JSON Schema for config file validation and IDE support

## Installation 📦

```bash
# Using bun
bun install -g sinfonia

# Using npm
npm install -g sinfonia

# Using yarn
yarn global add sinfonia
```

## Usage 🛠️

Sinfonia offers two modes of operation:

### Simple Mode (CLI)

For basic usage without dependencies:

```bash
# Single command
sinfonia "web=npm run dev"

# Multiple commands
sinfonia "web=npm run dev" "api=npm run server"

# With groups
sinfonia "frontend:web=npm run dev" "backend:api=npm run server"
```

Features available in CLI mode:

- Basic command running (`name=cmd`)
- Basic grouping (`group:name=cmd`)
- Buffer size (`-b, --buffer-size`)
- Log file (`-l, --log-file`)
- Config file (`-c, --config`)

### Advanced Mode (Config File)

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

Additional features in config mode:

- Everything from CLI mode
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

## Controls 🎮

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

## Preview

https://github.com/user-attachments/assets/5fadbe2d-8a22-4c18-af7f-9f8455e73bfa

## License 📄

[MIT](LICENSE)
