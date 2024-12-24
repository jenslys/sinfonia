# sinfonia 🎵

A beautiful process runner for parallel commands with interactive filtering.

## Features

- Run multiple commands in parallel
- Filter output by process with arrow keys
- Color-coded output for each process
- Interactive terminal UI
- Easy to use command format

## Installation

```bash
# Install globally
bun install -g sinfonia

# Or install locally
bun install sinfonia
```

## Usage

```bash
sinfonia "name=command" "name2=command2"

# Examples
sinfonia "next=bun dev" "api=bun api:dev"
sinfonia "dev=npm run dev" "api=npm run api" "db=docker compose up"

# Custom colors
sinfonia -c "red,blue,green" "next=bun dev" "api=bun api:dev"
```

## Controls

- `↑/↓` - Filter output by process
- `Ctrl+C` - Exit all processes

## Development

```bash
# Install dependencies
bun install

# Run in development mode
bun run dev

# Run tests
bun run test:all

# Build
bun run build
```

## License

ISC
