---
title: "[CLI] Command-Line Interface Tool"
labels: ["enhancement", "cli", "developer-experience"]
assignees: []
---

## Description
Chakravyuh AI needs a CLI tool (`chakra`) for developers to interact with the system from the terminal. This is essential for scripting, CI/CD integration, and power users.

## Requirements

### Command Structure
```
chakra
├── chat [message]          # Send a message to an agent
├── project
│   ├── list                # List all projects
│   ├── create <name>       # Create a new project  
│   ├── status <id>         # Get project status
│   └── delete <id>         # Delete a project
├── agent
│   ├── list                # List all agents
│   ├── status <id>         # Get agent status & health
│   ├── assign <agent> <project>  # Assign agent to project
│   └── release <agent>     # Release agent back to pool
├── workflow
│   ├── list                # List workflows
│   ├── run <id>            # Execute a workflow
│   └── status <id>         # Check workflow status
├── provider
│   ├── list                # List configured providers
│   ├── test <name>         # Test provider connection
│   └── switch <agent> <provider>  # Change agent's provider
├── memory
│   ├── query <text>        # Query semantic memory
│   └── clear <type>        # Clear memory tier
├── log
│   ├── tail [agent]        # Stream logs (like tail -f)
│   └── search <query>      # Search logs
└── config
    ├── show                # Show current config
    ├── validate            # Validate YAML configs
    └── reload              # Hot-reload configs
```

### Features
- Color output with ANSI escape codes
- JSON output flag (`--json`) for scripting
- Config file at `~/.chakravyuh/config.yaml`
- Tab completion for bash/zsh/fish
- Interactive mode with prompt loop

### Implementation
- Node.js with `commander` or `yargs`
- Connect to running Chakravyuh server via REST API
- Optional: embed mode (run server in-process)

## Acceptance Criteria
- [ ] All commands work as described
- [ ] Color-coded output is readable
- [ ] JSON output parses correctly in scripts
- [ ] Tab completion is installable
- [ ] Help text is clear and comprehensive
- [ ] Connection error handling is user-friendly
- [ ] Unit tests for CLI parsing

## Additional Context
The CLI makes Chakravyuh accessible for developers who prefer the terminal over a web dashboard.
