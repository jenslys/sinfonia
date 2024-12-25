# sinfonia 🎵

A beautiful process runner for parallel commands with interactive filtering and real-time output control.

> **sinfonia** _(n.)_ - from Italian, meaning "symphony": a harmonious combination of elements working together as one, just like an orchestra performing multiple parts in perfect coordination.

## Features ✨

- 🚀 Run multiple commands in parallel with a single terminal window
- 🎯 Filter and focus on specific process outputs using arrow keys
- 🎨 Color-coded outputs for easy process identification
- ⌨️ Interactive process control (start/stop/restart)
- 📊 Real-time output monitoring
- 🔄 Process state management
- 💾 Configurable output buffer size

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

Basic usage:

```bash
sinfonia "NAME=COMMAND" "NAME2=COMMAND2"
```

Real-world examples:

```bash
# Next.js + API development
sinfonia "next=npm run dev" "api=npm run server"

# Full-stack development setup
sinfonia "frontend=npm run dev" "api=npm run server" "db=docker compose up"

# Microservices development
sinfonia "auth=npm run auth" "users=npm run users" "gateway=npm run gateway"
```

### Options

```bash
# Custom colors
sinfonia -c "red,blue,green" "web=npm run dev" "api=npm run server"

# Custom buffer size (default: 100 lines per process)
sinfonia -b 200 "web=npm run dev" "api=npm run server"
```

## Controls 🎮

| Key      | Action                |
|----------|----------------------|
| `↑/↓`    | Filter process output |
| `r`      | Restart current process |
| `s`      | Stop/Start current process |
| `Ctrl+C` | Exit all processes   |

## Development 👩‍💻

```bash
# Clone and install dependencies
git clone https://github.com/yourusername/sinfonia.git
cd sinfonia
bun install

# Run in development mode
bun run dev

# Run test suite
bun run test:all

# Build for production
bun run build
```

## Preview

![preview-screenshot](https://media.cleanshot.cloud/media/19237/ssEkSOOhpPhptEMQmvuJYH8JuprioiRt5Gk30POR.jpeg?Expires=1735168137&Signature=KqCIliVJBpjOuU3AEWXgb8TOpcG-sexSnDup2q5bAGIPh1oViF5AvLVbBZIWj7GVRhS~jHDejavruyXBqRZ0BUdXxuaR6q1CsduiSmyf0T3toyJIp1605sAo8EzM8V7CphA~xKMbnUMDPQFyRmGzb5Na6F3iGUjPQ2u8ntkHjZ05BPfhvWeQoxAcjMqFzd-RxZfSt3ny~fzt~1kiTcz02hCZQxDQStOqhR7rGzepVSbiLpHurpfjrpi94Q52chxVsUT~oajBE4RZ1hWCJGpICEKT~uy7m4rGDXh9fgy3Ux0MV5UGUG6AUSZld77uP5vu0c0pZ0mbOETfdeVIf6O8dQ__&Key-Pair-Id=K269JMAT9ZF4GZ)

## License 📄

[MIT](LICENSE)
