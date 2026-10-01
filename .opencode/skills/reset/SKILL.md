---
name: reset
description: Clear sites/ and dist/ so the wizard can be run from scratch. Only use when user explicitly says "reset".
disable-model-invocation: true
user-invocable: true
allowed-tools: Bash(bun run reset), Bash(rm -rf sites dist), Bash(mkdir -p sites dist)
---

# Wizard Reset Workflow

Clears `sites/` and `dist/` so the wizard can be walked through from step 1 again.

## Rules

- **Trigger:** ONLY on explicit user request ("reset")
- Uses the project script `bun run reset` (removes + recreates both directories)
- The running dev server does NOT need a restart (wizard is stateless/file-backed)

## Steps

1. Run:
   ```
   bun run reset
   ```
2. Verify both directories exist and are empty (`ls sites dist`)
3. Confirm: "Workspace cleared. Wizard is ready for a fresh run at http://localhost:4321."
