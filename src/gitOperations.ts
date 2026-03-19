import * as vscode from 'vscode';
import * as path from 'path';

export interface RepositoryState {
	hasRepo: boolean;
	branch: string;
	changedFiles: number;
	stagedFiles: number;
	conflictFiles: number;
	ahead: number;
	behind: number;
	hasStashes: boolean;
	modifiedFiles: string[];
	stagedFilesList: string[];
	conflictFilesList: string[];
}

export class GitHelper {
	private state: RepositoryState = {
		hasRepo: false,
		branch: '',
		changedFiles: 0,
		stagedFiles: 0,
		conflictFiles: 0,
		ahead: 0,
		behind: 0,
		hasStashes: false,
		modifiedFiles: [],
		stagedFilesList: [],
		conflictFilesList: []
	};

	constructor() {
		// No need to find repository on construction
	}

	async hasRepository(): Promise<boolean> {
		return this.checkForRepository();
	}

	private async checkForRepository(): Promise<boolean> {
		try {
			const result = await this.runGitCommand(['rev-parse', '--is-inside-work-tree']);
			return result.trim() === 'true';
		} catch {
			return false;
		}
	}

	hasRepoSync(): boolean {
		return this.state.hasRepo;
	}

	async refresh(): Promise<void> {
		const hasRepo = await this.checkForRepository();

		if (!hasRepo) {
			this.state = {
				hasRepo: false,
				branch: '',
				changedFiles: 0,
				stagedFiles: 0,
				conflictFiles: 0,
				ahead: 0,
				behind: 0,
				hasStashes: false,
				modifiedFiles: [],
				stagedFilesList: [],
				conflictFilesList: []
			};
			return;
		}

		// Get branch
		let branch = '';
		try {
			const branchResult = await this.runGitCommand(['branch', '--show-current']);
			branch = branchResult.trim();
		} catch {
			branch = 'HEAD';
		}

		// Get modified files (working tree)
		let modifiedFiles: string[] = [];
		try {
			const modifiedResult = await this.runGitCommand(['status', '--porcelain']);
			const lines = modifiedResult.split('\n').filter(l => l.trim());
			modifiedFiles = lines
				.filter(l => l.startsWith(' M') || l.startsWith('??') || l.startsWith('MM'))
				.map(l => this.getFileName(l.substring(3)));
		} catch {
			modifiedFiles = [];
		}

		// Get staged files
		let stagedFiles: string[] = [];
		try {
			const stagedResult = await this.runGitCommand(['diff', '--staged', '--name-status']);
			const lines = stagedResult.split('\n').filter(l => l.trim());
			stagedFiles = lines.map(l => this.getFileName(l.substring(2)));
		} catch {
			stagedFiles = [];
		}

		// Get conflict files (unmerged)
		let conflictFiles: string[] = [];
		try {
			const conflictResult = await this.runGitCommand(['diff', '--name-status', '--diff-filter=U']);
			const lines = conflictResult.split('\n').filter(l => l.trim());
			conflictFiles = lines.map(l => this.getFileName(l.substring(2)));
		} catch {
			conflictFiles = [];
		}

		// Get ahead/behind
		let ahead = 0;
		let behind = 0;
		try {
			const revList = await this.runGitCommand(['rev-list', '--left-right', '--count', '@{upstream}...HEAD']);
			const counts = revList.trim().split(/\s+/);
			behind = parseInt(counts[0]) || 0;
			ahead = parseInt(counts[1]) || 0;
		} catch {
			// No upstream or not tracking
		}

		// Check for stashes
		let hasStashes = false;
		try {
			const stashResult = await this.runGitCommand(['stash', 'list']);
			hasStashes = stashResult.trim().length > 0;
		} catch {
			hasStashes = false;
		}

		this.state = {
			hasRepo: true,
			branch,
			changedFiles: modifiedFiles.length,
			stagedFiles: stagedFiles.length,
			conflictFiles: conflictFiles.length,
			ahead,
			behind,
			hasStashes,
			modifiedFiles,
			stagedFilesList: stagedFiles,
			conflictFilesList: conflictFiles
		};
	}

	getRepositoryState(): RepositoryState {
		return this.state;
	}

	private getFileName(filePath: string): string {
		return path.basename(filePath.trim());
	}

	private async runGitCommand(args: string[]): Promise<string> {
		const terminal = vscode.window.activeTerminal || vscode.window.createTerminal();
		const command = `git ${args.join(' ')}`;

		// Use a simpler approach - execute via workspace executeCommand
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			throw new Error('No workspace folder');
		}

		const { stdout } = await require('child_process').execSync(
			command,
			{ cwd: workspaceFolder.uri.fsPath, encoding: 'utf-8' }
		);

		return stdout;
	}

	async stageFile(filePath: string): Promise<void> {
		await vscode.commands.executeCommand('git.stage', vscode.Uri.file(filePath));
	}

	async unstageFile(filePath: string): Promise<void> {
		await vscode.commands.executeCommand('git.unstage', vscode.Uri.file(filePath));
	}

	async stageAll(): Promise<void> {
		await vscode.commands.executeCommand('git.stageAll');
	}

	async unstageAll(): Promise<void> {
		await vscode.commands.executeCommand('git.unstageAll');
	}

	async discardChanges(filePath: string): Promise<void> {
		await vscode.commands.executeCommand('git.discard', vscode.Uri.file(filePath));
	}

	async commit(message: string): Promise<void> {
		// Use the built-in Git commit command with message
		await vscode.commands.executeCommand('git.commit', message);
	}

	async amendCommit(message?: string): Promise<void> {
		await vscode.commands.executeCommand('git.commit.amend', message);
	}

	async push(): Promise<void> {
		await vscode.commands.executeCommand('git.push');
	}

	async pull(useRebase: boolean = false): Promise<void> {
		if (useRebase) {
			await vscode.commands.executeCommand('git.pullRebase');
		} else {
			await vscode.commands.executeCommand('git.pull');
		}
	}

	async fetch(): Promise<void> {
		await vscode.commands.executeCommand('git.fetch');
	}

	async getBranches(): Promise<string[]> {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) return [];

		try {
			const { stdout } = require('child_process').execSync(
				'git branch -a',
				{ cwd: workspaceFolder.uri.fsPath, encoding: 'utf-8' }
			);
			const branches = stdout.split('\n')
				.map((b: string) => b.trim().replace(/^\*\s*/, ''))
				.filter((b: string) => b && !b.startsWith('remotes/'));
			return branches;
		} catch {
			return [];
		}
	}

	async switchBranch(branch: string): Promise<void> {
		await vscode.commands.executeCommand('git.checkout', branch);
	}

	async createBranch(name: string): Promise<void> {
		await vscode.commands.executeCommand('git.createBranch', name);
	}

	async mergeBranch(branch: string): Promise<void> {
		await vscode.commands.executeCommand('git.merge', branch);
	}

	async stash(message?: string): Promise<void> {
		await vscode.commands.executeCommand('git.stash', message);
	}

	async stashPop(): Promise<void> {
		await vscode.commands.executeCommand('git.stashPop');
	}

	async initRepo(): Promise<void> {
		await vscode.commands.executeCommand('git.init');
	}

	async viewDiff(filePath: string): Promise<void> {
		await vscode.commands.executeCommand('git.viewDiff', vscode.Uri.file(filePath));
	}
}
