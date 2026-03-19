# GitFlow Pro

A modern VS Code extension for effortless Git operations, merge conflict resolution, and real-time code quality checks.

## Features

### 🌀 Easy Git Operations
- **Stage/Unstage Files** - Save changes for commit with one click
- **Quick Commit** - Save versions of your work effortlessly
- **Push/Pull** - Send and receive code from remote repositories
- **Branch Management** - Switch, create, and manage branches easily
- **Stash** - Temporarily save work in progress

### ⚡ Merge Conflict Resolution
- **Visual Conflict Detection** - See conflicts at a glance
- **One-Click Resolution** - Keep your code or accept incoming changes
- **Beginner-Friendly** - Clear explanations of what conflicts mean

### 🔍 Real-Time Code Quality
- **Auto Code Checking** - Detect issues as you code
- **ESLint Integration** - Industry-standard linting support
- **TypeScript Checks** - Type errors highlighted instantly
- **Auto-Fix** - Fix common issues with one click

### ⌨️ Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Stage All |
| `Ctrl+Enter` | Commit |
| `Ctrl+Shift+U` | Push |
| `Ctrl+Shift+D` | Pull |
| `Ctrl+Shift+R` | Fetch |
| `Ctrl+Shift+S` | Stash |
| `Ctrl+Shift+B` | Switch Branch |

## Installation

1. Download the `.vsix` file from Releases
2. Open VS Code
3. Go to Extensions (`Ctrl+Shift+X`)
4. Click the `...` menu → "Install from VSIX"
5. Select the downloaded file

## Getting Started

1. Open a folder containing a Git repository
2. The GitFlow Pro panel appears in the sidebar
3. Start using the quick actions to manage your code

## Requirements

- VS Code 1.75.0 or higher
- Git installed on your system

## Extension Settings

| Setting | Description |
|---------|-------------|
| `gitflowPro.useRebase` | Use rebase instead of merge when pulling |
| `gitflowPro.showBeginnerHelp` | Show helpful hints for Git actions |
| `gitflowPro.autoResolveSimple` | Automatically resolve simple conflicts |
| `gitflowPro.autoCodeCheck` | Check code on save |
| `gitflowPro.enableShortcuts` | Enable keyboard shortcuts |

## Commands

All commands are prefixed with `gitflowPro.`:
- `gitflowPro.refresh` - Refresh repository status
- `gitflowPro.stageAll` - Stage all changes
- `gitflowPro.commit` - Commit staged changes
- `gitflowPro.push` - Push to remote
- `gitflowPro.pull` - Pull from remote
- `gitflowPro.switchBranch` - Switch to another branch
- `gitflowPro.checkCurrentFile` - Check current file for issues

## Screenshots

The extension provides a clean, modern sidebar with:
- Branch information and sync status
- Quick action buttons
- File change lists
- Conflict resolution interface
- Code quality dashboard

## License

MIT License

---

Made with ❤️ by SimpleTools
# gitflow-pro-
