# sinfonia 🎵

A beautiful process runner for parallel commands with interactive filtering and real-time output control.

> **sinfonia** _(n.)_ - from Italian, meaning "symphony": a harmonious combination of elements working together as one, just like an orchestra performing multiple parts in perfect coordination.

## Features ✨

- 🚀 Run multiple commands in parallel with a single terminal window
- 👥 Group related processes for better organization
- 🎯 Filter and focus on specific process or group outputs using arrow keys
- 🎨 Color-coded outputs for easy process identification
- ⌨️ Interactive process/group control (start/stop/restart)
- 📊 Real-time output monitoring
- 🔄 Process state management
- 💾 Configurable output buffer size
- 🔗 Optional dependency ordering with ready state detection

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

Using groups:

```bash
sinfonia "GROUP:NAME=COMMAND" "GROUP:NAME2=COMMAND2"
```

Using dependencies and ready patterns:

```bash
# Basic dependency (no ready pattern)
sinfonia "api@db=npm run api"

# Single dependency with ready pattern
sinfonia "api@db=npm run api :: {
  db: 'Database ready'
}"

# Multiple dependencies
sinfonia "api@db,cache=npm run api"

# Multiple dependencies with ready patterns
sinfonia "api@db,cache,auth=npm run api :: {
  db: 'Database system is ready',
  cache: 'Ready to accept connections',
  auth: 'Auth service started'
}"

# Complex example with groups and multiple dependencies
sinfonia \
  "infra:db=docker compose up" \
  "infra:cache=redis-server" \
  "infra:auth=npm run auth" \
  "backend:api@db,cache,auth=npm run api :: {
    db: 'Database system is ready',
    cache: 'Ready to accept connections',
    auth: 'Auth service started'
  }" \
  "backend:worker@db,cache=npm run worker :: {
    db: 'Database system is ready',
    cache: 'Ready to accept connections'
  }" \
  "frontend:web@api=npm run dev :: {
    api: 'Server started on port 3000'
  }"
```

Real-world examples:

```bash
# Next.js + API + Database
sinfonia \
  "db=docker compose up" \
  "api@db=npm run api :: {
    db: 'Database system is ready'
  }" \
  "web@api=next dev :: {
    api: 'Server started on port'
  }"

# Microservices with shared dependencies
sinfonia \
  "db=docker compose up" \
  "cache=redis-server" \
  "auth@db,cache=npm run auth :: {
    db: 'Database ready',
    cache: 'Ready to accept'
  }" \
  "users@db,cache=npm run users :: {
    db: 'Database ready',
    cache: 'Ready to accept'
  }" \
  "gateway@auth,users=npm run gateway :: {
    auth: 'Auth ready on port 4000',
    users: 'Users ready on port 4001'
  }"

# Full-stack with background workers
sinfonia \
  "db=docker compose up" \
  "cache=redis-server" \
  "queue=rabbitmq-server" \
  "api@db,cache,queue=npm run api :: {
    db: 'PostgreSQL init process complete',
    cache: 'Ready to accept connections',
    queue: 'Server startup complete'
  }" \
  "worker@db,queue=npm run worker :: {
    db: 'PostgreSQL init process complete',
    queue: 'Server startup complete'
  }" \
  "web@api=npm run dev :: {
    api: 'Ready on port 3000'
  }"
```

### Command Format

```bash
[GROUP:]NAME[@DEP1,DEP2]=COMMAND[:: {DEP1: 'pattern', DEP2: 'pattern'}]
```

- `GROUP:` - Optional group name for organizing processes (e.g., `frontend:`)
- `NAME` - Process name (e.g., `api`)
- `@DEP1,DEP2` - Optional comma-separated dependencies (e.g., `@db,cache`)
- `COMMAND` - The actual command to run
- `:: {...}` - Optional JSON-like ready patterns for dependencies

Examples:

```bash
# Basic process
"web=npm run dev"

# With group
"frontend:web=npm run dev"

# With single dependency
"api@db=npm run api"

# With single dependency and ready pattern
"api@db=npm run api :: {
  db: 'Database ready'
}"

# With multiple dependencies and ready patterns
"api@db,cache,auth=npm run api :: {
  db: 'Database system is ready',
  cache: 'Ready to accept connections',
  auth: 'Auth service started'
}"

# Everything combined
"backend:api@db,cache=npm run api :: {
  db: 'Database ready',
  cache: 'Cache ready'
}"
```

### Dependencies

- Use `@` to specify dependencies (e.g., `api@db` means api depends on db)
- Multiple dependencies are comma-separated (e.g., `api@db,cache`)
- Ready patterns are specified after `::` in a JSON-like format
- Each dependency can have its own ready pattern
- A process will only start after all its dependencies are "ready"
- A process is considered "ready" when its output matches its ready pattern
- If no ready pattern is specified for a dependency, it's ready immediately after starting

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
| `↑/↓`    | Navigate processes/groups |
| `r`      | Restart process/group |
| `s`      | Stop/Start process/group |
| `Ctrl+C` | Exit all processes   |

## Preview

![preview-screenshot](https://media.cleanshot.cloud/media/19237/ssEkSOOhpPhptEMQmvuJYH8JuprioiRt5Gk30POR.jpeg?Expires=1735168137&Signature=KqCIliVJBpjOuU3AEWXgb8TOpcG-sexSnDup2q5bAGIPh1oViF5AvLVbBZIWj7GVRhS~jHDejavruyXBqRZ0BUdXxuaR6q1CsduiSmyf0T3toyJIp1605sAo8EzM8V7CphA~xKMbnUMDPQFyRmGzb5Na6F3iGUjPQ2u8ntkHjZ05BPfhvWeQoxAcjMqFzd-RxZfSt3ny~fzt~1kiTcz02hCZQxDQStOqhR7rGzepVSbiLpHurpfjrpi94Q52chxVsUT~oajBE4RZ1hWCJGpICEKT~uy7m4rGDXh9fgy3Ux0MV5UGUG6AUSZld77uP5vu0c0pZ0mbOETfdeVIf6O8dQ__&Key-Pair-Id=K269JMAT9ZF4GZ)

## Comparison with Other Tools 🔍

Sinfonia brings features that aren't available in other process managers:

### Feature Comparison

| Feature                          | Sinfonia | Concurrently | npm-run-all | Foreman |
|---------------------------------|----------|--------------|-------------|----------|
| Parallel Execution              | ✅       | ✅           | ✅          | ✅       |
| Process Grouping                | ✅       | ❌           | ❌          | ✅       |
| Interactive Output Filtering     | ✅       | ❌           | ❌          | ❌       |
| Color-coded Output              | ✅       | ✅           | ✅          | ✅       |
| Interactive Process Control      | ✅       | ❌           | ❌          | ❌       |
| Real-time Output Monitoring     | ✅       | ✅           | ✅          | ✅       |
| Process State Management        | ✅       | ❌           | ❌          | ✅       |
| Configurable Output Buffer      | ✅       | ❌           | ❌          | ❌       |
| Dependency Ordering             | ✅       | ❌           | ❌          | ❌       |
| Ready State Detection           | ✅       | ❌           | ❌          | ❌       |
| Setup Complexity                | Simple   | Simple       | Simple      | Medium   |

## License 📄

[MIT](LICENSE)
