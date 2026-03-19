import * as vscode from 'vscode';
import { GitHelper } from './gitOperations';
import { ConflictDetector, ConflictInfo } from './conflictDetector';
import { SidebarProvider } from './sidebar';
import { CodeChecker } from './codeChecker';

let gitHelper: GitHelper;
let conflictDetector: ConflictDetector;
let codeChecker: CodeChecker;
let sidebarProvider: SidebarProvider;
let statusBarItem: vscode.StatusBarItem;

// Context keys for command visibility
const HAS_REPO_KEY = 'gitflowPro:hasRepo';

export function activate(context: vscode.ExtensionContext) {
	// Initialize components
	gitHelper = new GitHelper();
	conflictDetector = new ConflictDetector();
	codeChecker = new CodeChecker();
	sidebarProvider = new SidebarProvider(context.extensionUri, gitHelper, conflictDetector);

	// Register sidebar view
	vscode.window.registerWebviewViewProvider(
		'simple-git-conflict-helper-main',
		sidebarProvider
	);

	// Create status bar item
	statusBarItem = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Left,
		100
	);
	statusBarItem.command = 'gitflowPro.refresh';
	statusBarItem.text = '$(refresh) Git Helper';
	statusBarItem.tooltip = 'Click to refresh Git status';
	context.subscriptions.push(statusBarItem);

	// Register commands
	registerCommands(context);

	// Set initial context
	updateContext();

	// Watch for workspace changes
	vscode.workspace.onDidChangeWorkspaceFolders(() => {
		updateContext();
		refreshAll();
	});

	// Watch for document changes (to detect conflicts)
	vscode.workspace.onDidOpenTextDocument((doc) => {
		checkForConflicts(doc);
	});

	vscode.workspace.onDidSaveTextDocument((doc) => {
		checkForConflicts(doc);
	});

	// Initial refresh
	refreshAll();

	console.log('Simple Git Conflict Helper activated!');
}

function registerCommands(context: vscode.ExtensionContext) {
	// Refresh
	context.subscriptions.push(
		vscode.commands.registerCommand('gitflowPro.refresh', async () => {
			await gitHelper.refresh();
			refreshAll();
		})
	);

	// Stage file
	context.subscriptions.push(
		vscode.commands.registerCommand('gitflowPro.stageFile', async () => {
			const filePath = getActiveFilePath();
			if (filePath) {
				await gitHelper.stageFile(filePath);
				refreshAll();
			}
		})
	);

	// Unstage file
	context.subscriptions.push(
		vscode.commands.registerCommand('gitflowPro.unstageFile', async () => {
			const filePath = getActiveFilePath();
			if (filePath) {
				await gitHelper.unstageFile(filePath);
				refreshAll();
			}
		})
	);

	// Stage all
	context.subscriptions.push(
		vscode.commands.registerCommand('gitflowPro.stageAll', async () => {
			await gitHelper.stageAll();
			refreshAll();
		})
	);

	// Unstage all
	context.subscriptions.push(
		vscode.commands.registerCommand('gitflowPro.unstageAll', async () => {
			await gitHelper.unstageAll();
			refreshAll();
		})
	);

	// Discard changes
	context.subscriptions.push(
		vscode.commands.registerCommand('gitflowPro.discardChanges', async () => {
			const filePath = getActiveFilePath();
			if (filePath) {
				const response = await vscode.window.showWarningMessage(
					'This will remove your unsaved code changes in this file. Are you sure?',
					{ modal: true },
					'Discard Changes',
					'Cancel'
				);
				if (response === 'Discard Changes') {
					await gitHelper.discardChanges(filePath);
					refreshAll();
				}
			}
		})
	);

	// Commit
	context.subscriptions.push(
		vscode.commands.registerCommand('gitflowPro.commit', async () => {
			const message = await vscode.window.showInputBox({
				prompt: 'Enter a description of your changes',
				placeHolder: 'What did you change?'
			});
			if (message) {
				await gitHelper.commit(message);
				refreshAll();
			}
		})
	);

	// Amend commit
	context.subscriptions.push(
		vscode.commands.registerCommand('gitflowPro.amendCommit', async () => {
			const message = await vscode.window.showInputBox({
				prompt: 'Update commit message (or leave empty to keep same)',
				placeHolder: 'Updated description'
			});
			await gitHelper.amendCommit(message || undefined);
			refreshAll();
		})
	);

	// Push
	context.subscriptions.push(
		vscode.commands.registerCommand('gitflowPro.push', async () => {
			await gitHelper.push();
			refreshAll();
		})
	);

	// Pull
	context.subscriptions.push(
		vscode.commands.registerCommand('gitflowPro.pull', async () => {
			const useRebase = vscode.workspace.getConfiguration('gitflowPro').get('useRebase', false);
			await gitHelper.pull(useRebase);
			refreshAll();
		})
	);

	// Fetch
	context.subscriptions.push(
		vscode.commands.registerCommand('gitflowPro.fetch', async () => {
			await gitHelper.fetch();
			refreshAll();
		})
	);

	// Switch branch
	context.subscriptions.push(
		vscode.commands.registerCommand('gitflowPro.switchBranch', async () => {
			const branches = await gitHelper.getBranches();
			const branch = await vscode.window.showQuickPick(branches, {
				placeHolder: 'Select a branch to switch to'
			});
			if (branch) {
				await gitHelper.switchBranch(branch);
				refreshAll();
			}
		})
	);

	// Create branch
	context.subscriptions.push(
		vscode.commands.registerCommand('gitflowPro.createBranch', async () => {
			const name = await vscode.window.showInputBox({
				prompt: 'Enter new branch name',
				placeHolder: 'feature/my-new-feature'
			});
			if (name) {
				await gitHelper.createBranch(name);
				refreshAll();
			}
		})
	);

	// Merge branch
	context.subscriptions.push(
		vscode.commands.registerCommand('gitflowPro.mergeBranch', async () => {
			const branches = await gitHelper.getBranches();
			const branch = await vscode.window.showQuickPick(branches, {
				placeHolder: 'Select a branch to merge'
			});
			if (branch) {
				await gitHelper.mergeBranch(branch);
				refreshAll();
			}
		})
	);

	// Stash
	context.subscriptions.push(
		vscode.commands.registerCommand('gitflowPro.stash', async () => {
			const message = await vscode.window.showInputBox({
				prompt: 'Describe what you\'re saving',
				placeHolder: 'Work in progress...'
			});
			await gitHelper.stash(message || undefined);
			refreshAll();
		})
	);

	// Stash pop
	context.subscriptions.push(
		vscode.commands.registerCommand('gitflowPro.stashPop', async () => {
			await gitHelper.stashPop();
			refreshAll();
		})
	);

	// Init repo
	context.subscriptions.push(
		vscode.commands.registerCommand('gitflowPro.initRepo', async () => {
			await gitHelper.initRepo();
			updateContext();
			refreshAll();
		})
	);

	// View diff
	context.subscriptions.push(
		vscode.commands.registerCommand('gitflowPro.viewDiff', async () => {
			const filePath = getActiveFilePath();
			if (filePath) {
				await gitHelper.viewDiff(filePath);
			}
		})
	);

	// Resolve conflict - keep mine
	context.subscriptions.push(
		vscode.commands.registerCommand('gitflowPro.resolveConflictKeepMine', async () => {
			const doc = vscode.window.activeTextEditor?.document;
			if (doc) {
				await conflictDetector.resolveCurrentConflict(doc, 'mine');
				refreshAll();
			}
		})
	);

	// Resolve conflict - keep other
	context.subscriptions.push(
		vscode.commands.registerCommand('gitflowPro.resolveConflictKeepOther', async () => {
			const doc = vscode.window.activeTextEditor?.document;
			if (doc) {
				await conflictDetector.resolveCurrentConflict(doc, 'other');
				refreshAll();
			}
		})
	);

	// Open settings
	context.subscriptions.push(
		vscode.commands.registerCommand('gitflowPro.openSettings', async () => {
			await vscode.commands.executeCommand('workbench.action.openSettings', 'gitflowPro');
		})
	);

	// Code check - current file
	context.subscriptions.push(
		vscode.commands.registerCommand('gitflowPro.checkCurrentFile', async () => {
			const issues = await codeChecker.checkCurrentFile();
			sidebarProvider.updateCodeIssues(issues);
			if (issues.length === 0) {
				sidebarProvider.showNotification('No issues found!', 'success');
			} else {
				sidebarProvider.showNotification(`Found ${issues.length} issues`, 'info');
			}
		})
	);

	// Code check - workspace
	context.subscriptions.push(
		vscode.commands.registerCommand('gitflowPro.checkWorkspace', async () => {
			const issues = await codeChecker.checkWorkspace();
			sidebarProvider.updateCodeIssues(issues);
			if (issues.length === 0) {
				sidebarProvider.showNotification('Workspace is clean!', 'success');
			} else {
				sidebarProvider.showNotification(`Found ${issues.length} issues in workspace`, 'info');
			}
		})
	);

	// Auto fix issues
	context.subscriptions.push(
		vscode.commands.registerCommand('gitflowPro.autoFixIssues', async () => {
			await codeChecker.autoFixAll();
		})
	);

	// Fix specific issue
	context.subscriptions.push(
		vscode.commands.registerCommand('gitflowPro.fixIssue', async (issue) => {
			await codeChecker.fixIssue(issue);
		})
	);
}

function getActiveFilePath(): string | undefined {
	const editor = vscode.window.activeTextEditor;
	if (editor) {
		return editor.document.uri.fsPath;
	}
	return undefined;
}

async function checkForConflicts(doc: vscode.TextDocument) {
	const conflicts = conflictDetector.detectConflicts(doc);
	if (conflicts.length > 0) {
		// Show conflict notification
		showConflictNotification(conflicts.length);

		// Update sidebar with conflict info
		sidebarProvider.updateConflicts(conflicts);
	}
}

function showConflictNotification(count: number) {
	const message = count === 1
		? `⚠ Conflict found in this file`
		: `⚠ ${count} conflicts found in this file`;

	const notification = vscode.window.showWarningMessage(
		message,
		{ modal: false },
		'View Conflicts'
	);

	notification.then((action) => {
		if (action === 'View Conflicts') {
			sidebarProvider.showConflictView();
		}
	});
}

async function updateContext() {
	const hasRepo = await gitHelper.hasRepository();
	vscode.commands.executeCommand('setContext', HAS_REPO_KEY, hasRepo);

	if (hasRepo) {
		statusBarItem.show();
	} else {
		statusBarItem.hide();
	}
}

async function refreshAll() {
	await gitHelper.refresh();
	const conflicts = conflictDetector.getConflictsInWorkspace();
	sidebarProvider.update(
		gitHelper.getRepositoryState(),
		conflicts
	);
}

export function deactivate() {
	// Cleanup
}
