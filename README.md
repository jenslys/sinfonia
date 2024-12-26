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
- Global color settings (`--color`)
- Buffer size (`-b, --buffer-size`)
- Log file (`-l, --log-file`)

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
      "color": "cyan",
      "commands": ["API", "WORKER"]
    },
    {
      "name": "FRONTEND",
      "color": "magenta",
      "commands": ["WEB"]
    }
  ],
  "options": {
    "bufferSize": 100
  }
}
```

The config file supports JSON Schema validation for better IDE support and validation.

### Options

```bash
# Custom colors (CLI only)
sinfonia --color "red,blue,green" "web=npm run dev" "api=npm run server"

# Custom buffer size
sinfonia -b 200 "web=npm run dev" "api=npm run server"

# Enable logging to file
sinfonia -l "output_{timestamp}.log" "web=npm run dev" "api=npm run server"

# Use custom config file
sinfonia -c custom.json
```

## Controls 🎮

| Key      | Action                |
|----------|----------------------|
| `↑/↓`    | Navigate processes/groups |
| `r`      | Restart process/group |
| `s`      | Stop/Start process/group |
| `f`      | Search in logs |
| `Ctrl+C` | Exit all processes   |

## Preview

![preview-screenshot](https://media.cleanshot.cloud/media/19237/ssEkSOOhpPhptEMQmvuJYH8JuprioiRt5Gk30POR.jpeg?Expires=1735168137&Signature=KqCIliVJBpjOuU3AEWXgb8TOpcG-sexSnDup2q5bAGIPh1oViF5AvLVbBZIWj7GVRhS~jHDejavruyXBqRZ0BUdXxuaR6q1CsduiSmyf0T3toyJIp1605sAo8EzM8V7CphA~xKMbnUMDPQFyRmGzb5Na6F3iGUjPQ2u8ntkHjZ05BPfhvWeQoxAcjMqFzd-RxZfSt3ny~fzt~1kiTcz02hCZQxDQStOqhR7rGzepVSbiLpHurpfjrpi94Q52chxVsUT~oajBE4RZ1hWCJGpICEKT~uy7m4rGDXh9fgy3Ux0MV5UGUG6AUSZld77uP5vu0c0pZ0mbOETfdeVIf6O8dQ__&Key-Pair-Id=K269JMAT9ZF4GZ)

## License 📄

[MIT](LICENSE)
