import * as vscode from 'vscode';
import * as path from 'path';
import { GitHelper, RepositoryState } from './gitOperations';
import { ConflictDetector, ConflictInfo } from './conflictDetector';
import { CodeChecker, CodeIssue } from './codeChecker';

export class SidebarProvider implements vscode.WebviewViewProvider {
	private _view?: vscode.WebviewView;
	private gitHelper: GitHelper;
	private conflictDetector: ConflictDetector;
	private codeChecker: CodeChecker;

	constructor(
		private readonly extensionUri: vscode.Uri,
		gitHelper: GitHelper,
		conflictDetector: ConflictDetector
	) {
		this.gitHelper = gitHelper;
		this.conflictDetector = conflictDetector;
		this.codeChecker = new CodeChecker();
	}

	resolveWebviewView(webviewView: vscode.WebviewView): void {
		this._view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this.extensionUri]
		};

		webviewView.webview.html = this.getHtml();

		// Handle messages from webview
		webviewView.webview.onDidReceiveMessage(async (message) => {
			await this.handleMessage(message);
		});
	}

	update(state: RepositoryState, conflicts: ConflictInfo[]) {
		if (this._view) {
			this._view.webview.postMessage({
				type: 'update',
				state,
				conflicts
			});
		}
	}

	updateConflicts(conflicts: ConflictInfo[]) {
		if (this._view) {
			this._view.webview.postMessage({
				type: 'conflicts',
				conflicts
			});
		}
	}

	updateCodeIssues(issues: CodeIssue[]) {
		if (this._view) {
			this._view.webview.postMessage({
				type: 'codeIssues',
				issues
			});
		}
	}

	showConflictView() {
		if (this._view) {
			this._view.show();
			this._view.webview.postMessage({ type: 'showConflicts' });
		}
	}

	showNotification(message: string, type: 'success' | 'error' | 'info') {
		if (this._view) {
			this._view.webview.postMessage({
				type: 'notification',
				message,
				notificationType: type
			});
		}
	}

	private async handleMessage(message: any): Promise<void> {
		switch (message.command) {
			case 'refresh':
				await vscode.commands.executeCommand('gitflowPro.refresh');
				break;
			case 'stageFile':
				await vscode.commands.executeCommand('gitflowPro.stageFile');
				break;
			case 'unstageFile':
				await vscode.commands.executeCommand('gitflowPro.unstageFile');
				break;
			case 'stageAll':
				await vscode.commands.executeCommand('gitflowPro.stageAll');
				break;
			case 'unstageAll':
				await vscode.commands.executeCommand('gitflowPro.unstageAll');
				break;
			case 'discard':
				await vscode.commands.executeCommand('gitflowPro.discardChanges');
				break;
			case 'commit':
				await vscode.commands.executeCommand('gitflowPro.commit');
				break;
			case 'push':
				await vscode.commands.executeCommand('gitflowPro.push');
				break;
			case 'pull':
				await vscode.commands.executeCommand('gitflowPro.pull');
				break;
			case 'fetch':
				await vscode.commands.executeCommand('gitflowPro.fetch');
				break;
			case 'switchBranch':
				await vscode.commands.executeCommand('gitflowPro.switchBranch');
				break;
			case 'createBranch':
				await vscode.commands.executeCommand('gitflowPro.createBranch');
				break;
			case 'stash':
				await vscode.commands.executeCommand('gitflowPro.stash');
				break;
			case 'stashPop':
				await vscode.commands.executeCommand('gitflowPro.stashPop');
				break;
			case 'viewConflict':
				const fileUri = vscode.Uri.file(message.filePath);
				const doc = await vscode.workspace.openTextDocument(fileUri);
				await vscode.window.showTextDocument(doc);
				break;
			case 'resolveKeepMine':
				await vscode.commands.executeCommand('gitflowPro.resolveConflictKeepMine');
				break;
			case 'resolveKeepOther':
				await vscode.commands.executeCommand('gitflowPro.resolveConflictKeepOther');
				break;
			case 'runCodeCheck':
			case 'checkCurrentFile':
				await this.runCodeCheck();
				break;
			case 'checkWorkspace':
				await this.runWorkspaceCheck();
				break;
			case 'autoFixIssues':
				await this.runAutoFix();
				break;
			case 'fixIssue':
				await this.codeChecker.fixIssue(message.issue);
				break;
			case 'openFile':
				const targetFile = vscode.Uri.file(message.filePath);
				const targetDoc = await vscode.workspace.openTextDocument(targetFile);
				const editor = await vscode.window.showTextDocument(targetDoc);
				// Go to the line with the issue
				if (message.line) {
					const position = new vscode.Position(message.line - 1, 0);
					editor.selection = new vscode.Selection(position, position);
					editor.revealRange(new vscode.Range(position, position));
				}
				break;
		}
	}

	private async runCodeCheck(): Promise<void> {
		const issues = await this.codeChecker.checkCurrentFile();
		this.updateCodeIssues(issues);
	}

	private async runWorkspaceCheck(): Promise<void> {
		const issues = await this.codeChecker.checkWorkspace();
		this.updateCodeIssues(issues);
	}

	private async runAutoFix(): Promise<void> {
		await this.codeChecker.autoFixAll();
	}

	private getHtml(): string {
		return `<!DOCTYPE html>
<html>
<head>
	<style>
		:root {
			--bg-primary: #1e1e1e;
			--bg-secondary: #252526;
			--bg-tertiary: #2d2d30;
			--text-primary: #cccccc;
			--text-secondary: #858585;
			--accent-green: #4ec9b0;
			--accent-blue: #569cd6;
			--accent-yellow: #dcdcaa;
			--accent-red: #f14c4c;
			--accent-purple: #c586c0;
			--accent-orange: #ce9178;
			--border-color: #3c3c3c;
		}

		* {
			box-sizing: border-box;
		}

		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
			background-color: var(--bg-primary);
			color: var(--text-primary);
			margin: 0;
			padding: 0;
			font-size: 13px;
			overflow-x: hidden;
		}

		.container {
			padding: 12px;
		}

		/* Animations */
		@keyframes fadeIn {
			from { opacity: 0; transform: translateY(10px); }
			to { opacity: 1; transform: translateY(0); }
		}

		@keyframes slideIn {
			from { opacity: 0; transform: translateX(-20px); }
			to { opacity: 1; transform: translateX(0); }
		}

		@keyframes pulse {
			0%, 100% { transform: scale(1); }
			50% { transform: scale(1.05); }
		}

		@keyframes spin {
			from { transform: rotate(0deg); }
			to { transform: rotate(360deg); }
		}

		@keyframes shimmer {
			0% { background-position: -200% 0; }
			100% { background-position: 200% 0; }
		}

		@keyframes bounce {
			0%, 100% { transform: translateY(0); }
			50% { transform: translateY(-5px); }
		}

		@keyframes glow {
			0%, 100% { box-shadow: 0 0 5px var(--accent-green); }
			50% { box-shadow: 0 0 20px var(--accent-green); }
		}

		@keyframes shake {
			0%, 100% { transform: translateX(0); }
			25% { transform: translateX(-5px); }
			75% { transform: translateX(5px); }
		}

		@keyframes typing {
			from { width: 0; }
			to { width: 100%; }
		}

		@keyframes blink {
			0%, 100% { opacity: 1; }
			50% { opacity: 0; }
		}

		@keyframes ripple {
			0% { transform: scale(0); opacity: 1; }
			100% { transform: scale(4); opacity: 0; }
		}

		@keyframes float {
			0%, 100% { transform: translateY(0); }
			50% { transform: translateY(-8px); }
		}

		@keyframes progress {
			0% { width: 0%; }
			100% { width: 100%; }
		}

		@keyframes confetti {
			0% { transform: translateY(0) rotate(0deg); opacity: 1; }
			100% { transform: translateY(-100px) rotate(720deg); opacity: 0; }
		}

		@keyframes slideUp {
			from { opacity: 0; transform: translateY(20px); }
			to { opacity: 1; transform: translateY(0); }
		}

		@keyframes scaleIn {
			from { opacity: 0; transform: scale(0.9); }
			to { opacity: 1; transform: scale(1); }
		}

		.animate-fade-in {
			animation: fadeIn 0.3s ease-out forwards;
		}

		.animate-slide-in {
			animation: slideIn 0.3s ease-out forwards;
		}

		.animate-pulse {
			animation: pulse 2s infinite;
		}

		.animate-spin {
			animation: spin 1s linear infinite;
		}

		.animate-bounce {
			animation: bounce 0.5s ease-in-out;
		}

		.animate-shake {
			animation: shake 0.5s ease-in-out;
		}

		.animate-float {
			animation: float 3s ease-in-out infinite;
		}

		.animate-typing {
			animation: typing 2s steps(30) forwards;
		}

		.animate-blink {
			animation: blink 1s step-end infinite;
		}

		.animate-slide-up {
			animation: slideUp 0.4s ease-out forwards;
		}

		.animate-scale-in {
			animation: scaleIn 0.3s ease-out forwards;
		}

		/* Ripple effect for buttons */
		.btn {
			position: relative;
			overflow: hidden;
		}

		.btn::after {
			content: '';
			position: absolute;
			top: 50%;
			left: 50%;
			width: 0;
			height: 0;
			background: rgba(255,255,255,0.3);
			border-radius: 50%;
			transform: translate(-50%, -50%);
			transition: width 0.6s, height 0.6s;
		}

		.btn:active::after {
			width: 300px;
			height: 300px;
		}

		/* Skeleton loading */
		.skeleton {
			background: linear-gradient(90deg, var(--bg-tertiary) 25%, var(--bg-secondary) 50%, var(--bg-tertiary) 75%);
			background-size: 200% 100%;
			animation: shimmer 1.5s infinite;
			border-radius: 4px;
		}

		.skeleton-text {
			height: 14px;
			margin-bottom: 8px;
		}

		.skeleton-title {
			height: 24px;
			width: 60%;
			margin-bottom: 12px;
		}

		.skeleton-button {
			height: 36px;
			width: 100px;
		}

		/* Hover lift effect */
		.hover-lift {
			transition: transform 0.3s ease, box-shadow 0.3s ease;
		}

		.hover-lift:hover {
			transform: translateY(-4px);
			box-shadow: 0 8px 25px rgba(0,0,0,0.3);
		}

		/* Progress bar */
		.progress-bar {
			height: 4px;
			background: var(--bg-tertiary);
			border-radius: 2px;
			overflow: hidden;
			margin: 8px 0;
		}

		.progress-bar-fill {
			height: 100%;
			background: linear-gradient(90deg, var(--accent-blue), var(--accent-green));
			border-radius: 2px;
			transition: width 0.5s ease;
		}

		/* Badge animations */
		.badge-new {
			animation: pulse 2s infinite;
		}

		.badge-success {
			animation: glow 2s infinite;
		}

		.stagger-1 { animation-delay: 0.05s; }
		.stagger-2 { animation-delay: 0.1s; }
		.stagger-3 { animation-delay: 0.15s; }
		.stagger-4 { animation-delay: 0.2s; }
		.stagger-5 { animation-delay: 0.25s; }

		.card {
			background-color: var(--bg-secondary);
			border-radius: 8px;
			padding: 12px;
			margin-bottom: 12px;
			opacity: 0;
			animation: fadeIn 0.3s ease-out forwards;
		}

		.card-header {
			display: flex;
			align-items: center;
			margin-bottom: 8px;
		}

		.icon {
			margin-right: 8px;
			font-size: 16px;
		}

		.title {
			font-weight: 600;
			font-size: 14px;
		}

		.branch-badge {
			background: linear-gradient(135deg, var(--accent-blue), #6fa8dc);
			color: white;
			padding: 2px 10px;
			border-radius: 12px;
			font-size: 11px;
			margin-left: auto;
			box-shadow: 0 2px 4px rgba(86, 156, 214, 0.3);
		}

		.stats {
			display: flex;
			gap: 12px;
			flex-wrap: wrap;
		}

		.stat {
			display: flex;
			align-items: center;
			gap: 4px;
			padding: 6px 10px;
			border-radius: 6px;
			background-color: var(--bg-tertiary);
			transition: all 0.2s ease;
		}

		.stat:hover {
			transform: translateY(-2px);
			box-shadow: 0 4px 8px rgba(0,0,0,0.2);
		}

		.stat-changed { color: var(--accent-yellow); border-left: 3px solid var(--accent-yellow); }
		.stat-staged { color: var(--accent-green); border-left: 3px solid var(--accent-green); }
		.stat-conflict { color: var(--accent-red); border-left: 3px solid var(--accent-red); }

		.btn {
			background-color: var(--bg-tertiary);
			border: 1px solid var(--border-color);
			color: var(--text-primary);
			padding: 8px 14px;
			border-radius: 6px;
			cursor: pointer;
			font-size: 12px;
			transition: all 0.2s ease;
			display: inline-flex;
			align-items: center;
			gap: 6px;
			position: relative;
			overflow: hidden;
		}

		.btn::before {
			content: '';
			position: absolute;
			top: 0;
			left: -100%;
			width: 100%;
			height: 100%;
			background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
			transition: left 0.5s ease;
		}

		.btn:hover::before {
			left: 100%;
		}

		.btn:hover {
			transform: translateY(-2px);
			box-shadow: 0 4px 12px rgba(0,0,0,0.3);
		}

		.btn:active {
			transform: translateY(0);
		}

		.btn-primary {
			background: linear-gradient(135deg, var(--accent-blue), #4a8dc7);
			border-color: var(--accent-blue);
			color: white;
		}

		.btn-primary:hover {
			background: linear-gradient(135deg, #6fa8dc, var(--accent-blue));
		}

		.btn-green {
			background: linear-gradient(135deg, var(--accent-green), #45b39d);
			border-color: var(--accent-green);
			color: #1e1e1e;
		}

		.btn-green:hover {
			background: linear-gradient(135deg, #5cc4b8, var(--accent-green));
		}

		.btn-red {
			background: linear-gradient(135deg, var(--accent-red), #d43f3f);
			border-color: var(--accent-red);
			color: white;
		}

		.btn-red:hover {
			background: linear-gradient(135deg, #f55a5a, var(--accent-red));
		}

		.btn-purple {
			background: linear-gradient(135deg, var(--accent-purple), #a55db3);
			border-color: var(--accent-purple);
			color: white;
		}

		.btn-orange {
			background: linear-gradient(135deg, var(--accent-orange), #b87a5a);
			border-color: var(--accent-orange);
			color: white;
		}

		.btn-group {
			display: flex;
			flex-wrap: wrap;
			gap: 8px;
			margin-top: 8px;
		}

		.conflict-card {
			border-left: 4px solid var(--accent-red);
			background: linear-gradient(135deg, var(--bg-secondary), #2a2525);
		}

		.conflict-title {
			color: var(--accent-red);
			font-weight: 600;
		}

		.code-block {
			background-color: var(--bg-tertiary);
			padding: 10px;
			border-radius: 6px;
			font-family: 'Consolas', 'Monaco', monospace;
			font-size: 11px;
			overflow-x: auto;
			white-space: pre;
			margin: 8px 0;
			position: relative;
		}

		.code-block::before {
			content: '';
			position: absolute;
			top: 0;
			left: 0;
			right: 0;
			height: 3px;
			border-radius: 6px 6px 0 0;
		}

		.code-mine::before {
			background: var(--accent-yellow);
		}

		.code-theirs::before {
			background: var(--accent-blue);
		}

		.file-list {
			list-style: none;
			padding: 0;
			margin: 8px 0;
		}

		.file-item {
			padding: 8px 10px;
			border-radius: 6px;
			cursor: pointer;
			display: flex;
			align-items: center;
			gap: 8px;
			transition: all 0.2s ease;
			margin-bottom: 4px;
		}

		.file-item:hover {
			background-color: var(--bg-tertiary);
			transform: translateX(4px);
			padding-left: 14px;
		}

		.file-item .status-icon {
			font-size: 14px;
		}

		.empty-state {
			text-align: center;
			padding: 40px 20px;
			color: var(--text-secondary);
		}

		.empty-state .icon {
			font-size: 64px;
			margin-bottom: 16px;
			display: block;
			animation: pulse 2s infinite;
		}

		.empty-state p {
			margin: 8px 0;
		}

		.sync-status {
			display: flex;
			align-items: center;
			gap: 8px;
			font-size: 11px;
			color: var(--text-secondary);
			margin-top: 8px;
			padding-top: 8px;
			border-top: 1px solid var(--border-color);
		}

		.sync-ahead { color: var(--accent-green); }
		.sync-behind { color: var(--accent-yellow); }

		.help-text {
			font-size: 11px;
			color: var(--text-secondary);
			margin-top: 6px;
			font-style: italic;
		}

		.section {
			margin-bottom: 16px;
		}

		.section-title {
			font-size: 11px;
			text-transform: uppercase;
			color: var(--text-secondary);
			margin-bottom: 10px;
			letter-spacing: 1px;
			display: flex;
			align-items: center;
			gap: 6px;
		}

		.section-title::before {
			content: '';
			width: 3px;
			height: 12px;
			background: var(--accent-blue);
			border-radius: 2px;
		}

		/* Toast Notifications */
		.toast-container {
			position: fixed;
			top: 12px;
			right: 12px;
			z-index: 1000;
			display: flex;
			flex-direction: column;
			gap: 8px;
		}

		.toast {
			padding: 12px 16px;
			border-radius: 8px;
			color: white;
			font-size: 12px;
			display: flex;
			align-items: center;
			gap: 8px;
			animation: slideIn 0.3s ease-out, fadeIn 0.3s ease-out;
			box-shadow: 0 4px 12px rgba(0,0,0,0.3);
			max-width: 250px;
		}

		.toast-success { background: linear-gradient(135deg, var(--accent-green), #3da892); }
		.toast-error { background: linear-gradient(135deg, var(--accent-red), #d43f3f); }
		.toast-info { background: linear-gradient(135deg, var(--accent-blue), #4a8dc7); }

		/* Loading Spinner */
		.spinner {
			width: 16px;
			height: 16px;
			border: 2px solid transparent;
			border-top-color: currentColor;
			border-radius: 50%;
			animation: spin 0.8s linear infinite;
		}

		/* Code Issues */
		.issue-card {
			background: linear-gradient(135deg, var(--bg-secondary), #2a2525);
			border-left: 4px solid var(--accent-orange);
			padding: 10px;
			border-radius: 6px;
			margin-bottom: 8px;
			cursor: pointer;
			transition: all 0.2s ease;
		}

		.issue-card:hover {
			transform: translateX(4px);
			box-shadow: 0 4px 12px rgba(0,0,0,0.2);
		}

		.issue-card .issue-header {
			display: flex;
			align-items: center;
			gap: 8px;
			margin-bottom: 4px;
		}

		.issue-card .issue-type {
			font-size: 11px;
			padding: 2px 6px;
			border-radius: 4px;
			font-weight: 600;
		}

		.issue-type.error { background: var(--accent-red); color: white; }
		.issue-type.warning { background: var(--accent-yellow); color: #1e1e1e; }
		.issue-type.info { background: var(--accent-blue); color: white; }

		.issue-card .issue-message {
			font-size: 12px;
			color: var(--text-primary);
		}

		.issue-card .issue-location {
			font-size: 10px;
			color: var(--text-secondary);
			margin-top: 4px;
		}

		/* Tabs */
		.tab-container {
			display: flex;
			gap: 4px;
			margin-bottom: 12px;
			background: var(--bg-tertiary);
			padding: 4px;
			border-radius: 8px;
		}

		.tab {
			padding: 8px 16px;
			border-radius: 6px;
			cursor: pointer;
			font-size: 12px;
			background: transparent;
			border: none;
			color: var(--text-primary);
			transition: all 0.2s ease;
			flex: 1;
			text-align: center;
		}

		.tab.active {
			background: var(--accent-blue);
			color: white;
			box-shadow: 0 2px 8px rgba(86, 156, 214, 0.4);
		}

		.tab:hover:not(.active) {
			background: rgba(86, 156, 214, 0.2);
		}

		/* Shortcuts Display */
		.shortcut {
			display: inline-flex;
			align-items: center;
			gap: 4px;
			font-size: 10px;
			color: var(--text-secondary);
			background: var(--bg-tertiary);
			padding: 2px 6px;
			border-radius: 4px;
			margin-left: auto;
		}

		.shortcut kbd {
			background: var(--bg-secondary);
			padding: 1px 4px;
			border-radius: 3px;
			border: 1px solid var(--border-color);
			font-family: inherit;
		}

		/* Progress indicator */
		.progress-dots {
			display: flex;
			gap: 6px;
			margin-bottom: 12px;
		}

		.progress-dot {
			width: 8px;
			height: 8px;
			border-radius: 50%;
			background: var(--bg-tertiary);
			transition: all 0.3s ease;
		}

		.progress-dot.active {
			background: var(--accent-blue);
			box-shadow: 0 0 8px var(--accent-blue);
		}

		.progress-dot.completed {
			background: var(--accent-green);
		}

		.hidden { display: none !important; }

		/* Scrollbar */
		::-webkit-scrollbar {
			width: 6px;
		}

		::-webkit-scrollbar-track {
			background: var(--bg-secondary);
		}

		::-webkit-scrollbar-thumb {
			background: var(--bg-tertiary);
			border-radius: 3px;
		}

		::-webkit-scrollbar-thumb:hover {
			background: var(--text-secondary);
		}

		/* Tooltips */
		[data-tooltip] {
			position: relative;
		}

		[data-tooltip]::before {
			content: attr(data-tooltip);
			position: absolute;
			bottom: 100%;
			left: 50%;
			transform: translateX(-50%);
			padding: 6px 10px;
			background: var(--bg-tertiary);
			color: var(--text-primary);
			font-size: 11px;
			border-radius: 4px;
			white-space: nowrap;
			opacity: 0;
			pointer-events: none;
			transition: opacity 0.2s, transform 0.2s;
			transform: translateX(-50%) translateY(5px);
			box-shadow: 0 2px 8px rgba(0,0,0,0.3);
			z-index: 100;
		}

		[data-tooltip]:hover::before {
			opacity: 1;
			transform: translateX(-50%) translateY(-5px);
		}

		/* Status indicator dots */
		.status-dot {
			width: 8px;
			height: 8px;
			border-radius: 50%;
			display: inline-block;
		}

		.status-dot.success { background: var(--accent-green); box-shadow: 0 0 8px var(--accent-green); }
		.status-dot.warning { background: var(--accent-yellow); box-shadow: 0 0 8px var(--accent-yellow); }
		.status-dot.error { background: var(--accent-red); box-shadow: 0 0 8px var(--accent-red); }
		.status-dot.info { background: var(--accent-blue); box-shadow: 0 0 8px var(--accent-blue); }

		/* Animated gradient backgrounds */
		.gradient-bg {
			background: linear-gradient(-45deg, var(--bg-secondary), var(--bg-tertiary), var(--bg-secondary));
			background-size: 200% 200%;
			animation: shimmer 3s ease infinite;
		}

		/* Number counter animation */
		.counter {
			display: inline-block;
			font-variant-numeric: tabular-nums;
			transition: transform 0.2s;
		}

		.counter.bump {
			animation: pulse 0.3s ease-out;
		}

		/* Icon animations */
		.icon-hover {
			transition: transform 0.2s ease;
			cursor: pointer;
		}

		.icon-hover:hover {
			transform: scale(1.2);
		}

		.icon-spin:hover {
			animation: spin 1s linear infinite;
		}

		/* Card hover effects */
		.card {
			transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
		}

		.card:hover {
			box-shadow: 0 8px 25px rgba(0,0,0,0.2);
		}

		/* Keyboard shortcut hint */
		.kbd-group {
			display: inline-flex;
			align-items: center;
			gap: 2px;
		}

		.kbd-group kbd {
			font-size: 10px;
			padding: 2px 5px;
			background: var(--bg-primary);
			border: 1px solid var(--border-color);
			border-radius: 3px;
			color: var(--text-secondary);
		}

		/* Mini action bar */
		.mini-actions {
			display: flex;
			gap: 4px;
			opacity: 0;
			transition: opacity 0.2s;
		}

		.file-item:hover .mini-actions {
			opacity: 1;
		}

		.mini-btn {
			padding: 4px 8px;
			font-size: 10px;
			border-radius: 4px;
			cursor: pointer;
			border: none;
			background: var(--bg-primary);
			color: var(--text-secondary);
			transition: all 0.2s;
		}

		.mini-btn:hover {
			background: var(--accent-blue);
			color: white;
		}

		.mini-btn.danger:hover {
			background: var(--accent-red);
		}

		/* Celebration animation */
		.celebration {
			position: fixed;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			pointer-events: none;
			z-index: 9999;
		}

		.confetti {
			position: absolute;
			width: 10px;
			height: 10px;
			animation: confetti 1s ease-out forwards;
		}
	</style>
</head>
<body>
	<div class="toast-container" id="toast-container"></div>

	<div class="container">
		<!-- No Repository State -->
		<div id="no-repo" class="empty-state">
			<span class="icon">📁</span>
			<p class="title" style="font-size: 16px;">No Git repository found</p>
			<p class="help-text">Open a folder with Git or initialize a new repository</p>
			<button class="btn btn-primary animate-bounce" onclick="initRepo()" style="margin-top: 16px;">
				<span>🚀</span> Start Git Tracking
			</button>
		</div>

		<!-- Repository Status -->
		<div id="repo-status" class="hidden">
			<!-- Tab Navigation -->
			<div class="tab-container">
				<button class="tab active" data-tab="main" onclick="switchTab('main')">
					<span>🏠</span> Main
				</button>
				<button class="tab" data-tab="conflicts" onclick="switchTab('conflicts')">
					<span>⚠️</span> Conflicts
				</button>
				<button class="tab" data-tab="code" onclick="switchTab('code')">
					<span>🔍</span> Code Check
				</button>
			</div>

			<!-- Main Tab -->
			<div id="tab-main">
				<!-- Branch & Sync -->
				<div class="card stagger-1">
					<div class="card-header">
						<span class="icon">🌿</span>
						<span class="title" id="branch-name">main</span>
						<span class="branch-badge" id="branch-badge">Branch</span>
					</div>
					<div class="sync-status" id="sync-status">
						<span class="sync-ahead hidden" id="ahead-badge">↑ 0 to send</span>
						<span class="sync-behind hidden" id="behind-badge">↓ 0 to get</span>
					</div>
				</div>

				<!-- Quick Stats -->
				<div class="card stagger-2">
					<div class="stats">
						<div class="stat stat-changed" title="Changed files">
							<span>📝</span>
							<span id="changed-count">0</span> changes
						</div>
						<div class="stat stat-staged" title="Staged files">
							<span>✅</span>
							<span id="staged-count">0</span> staged
						</div>
						<div class="stat stat-conflict hidden" id="conflict-stat" title="Conflict files">
							<span>⚠️</span>
							<span id="conflict-count">0</span> conflicts
						</div>
					</div>
				</div>

				<!-- Quick Actions -->
				<div class="section stagger-3">
					<div class="section-title">Quick Actions</div>
					<div class="btn-group">
						<button class="btn" onclick="stageAll()" title="Save all changes for commit">
							<span>✅</span> Stage All
							<span class="shortcut"><kbd>Ctrl</kbd>+<kbd>S</kbd></span>
						</button>
						<button class="btn" onclick="unstageAll()" title="Remove all from commit">
							<span>↩️</span> Unstage
						</button>
						<button class="btn btn-primary" onclick="commit()" title="Save a version of your work">
							<span>💾</span> Commit
							<span class="shortcut"><kbd>Ctrl</kbd>+<kbd>Enter</kbd></span>
						</button>
					</div>
				</div>

				<div class="section stagger-4">
					<div class="btn-group">
						<button class="btn" onclick="pull()" title="Get latest code from shared repo">
							<span>⬇️</span> Get Latest
							<span class="shortcut"><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd></span>
						</button>
						<button class="btn" onclick="push()" title="Send your code to shared repo">
							<span>⬆️</span> Send Code
							<span class="shortcut"><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>U</kbd></span>
						</button>
						<button class="btn" onclick="fetch()" title="Check for updates">
							<span>🔄</span> Refresh
							<span class="shortcut"><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd></span>
						</button>
					</div>
				</div>

				<div class="section stagger-5">
					<div class="btn-group">
						<button class="btn" onclick="switchBranch()" title="Change to another branch">
							<span>🔀</span> Switch
							<span class="shortcut"><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd></span>
						</button>
						<button class="btn" onclick="createBranch()" title="Create a new branch">
							<span>🌱</span> New Branch
						</button>
						<button class="btn" onclick="stash()" title="Temporarily save work">
							<span>📦</span> Stash
							<span class="shortcut"><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd></span>
						</button>
					</div>
				</div>

				<!-- Changed Files -->
				<div class="section">
					<div class="section-title">📝 Changed Files</div>
					<ul class="file-list" id="changed-files">
						<li class="file-item" style="color: var(--text-secondary);">No changes</li>
					</ul>
				</div>

				<!-- Staged Files -->
				<div class="section">
					<div class="section-title">✅ Staged Files</div>
					<ul class="file-list" id="staged-files">
						<li class="file-item" style="color: var(--text-secondary);">No staged files</li>
					</ul>
				</div>
			</div>

			<!-- Conflicts Tab -->
			<div id="tab-conflicts" class="hidden">
				<div class="progress-dots" id="conflict-progress"></div>
				<div id="conflict-list"></div>
			</div>

			<!-- Code Check Tab -->
			<div id="tab-code" class="hidden">
				<div class="section">
					<div class="section-title">Code Analysis</div>
					<div class="btn-group">
						<button class="btn btn-orange" onclick="runCodeCheck()" title="Check current file for issues">
							<span>🔍</span> Check Current
						</button>
						<button class="btn btn-purple" onclick="checkWorkspace()" title="Check all files in workspace">
							<span>📁</span> Check All
						</button>
						<button class="btn btn-green" onclick="autoFixIssues()" title="Automatically fix fixable issues">
							<span>🔧</span> Auto Fix
						</button>
					</div>
					<p class="help-text">Run code analysis to find issues</p>
				</div>

				<div class="section">
					<div class="section-title">Quick Filters</div>
					<div class="btn-group">
						<button class="btn" onclick="filterIssues('error')" title="Show only errors">
							<span class="status-dot error"></span> Errors
						</button>
						<button class="btn" onclick="filterIssues('warning')" title="Show only warnings">
							<span class="status-dot warning"></span> Warnings
						</button>
						<button class="btn" onclick="filterIssues('info')" title="Show only info">
							<span class="status-dot info"></span> Info
						</button>
						<button class="btn" onclick="filterIssues('all')" title="Show all">
							<span>📋</span> All
						</button>
					</div>
				</div>

				<div class="card" style="margin-top: 12px;">
					<div class="card-header">
						<span class="icon">📊</span>
						<span class="title">Issues Summary</span>
					</div>
					<div class="stats" id="issues-summary">
						<div class="stat stat-conflict">
							<span class="status-dot error"></span>
							<span id="error-count">0</span> Errors
						</div>
						<div class="stat" style="color: var(--accent-yellow); border-left: 3px solid var(--accent-yellow);">
							<span class="status-dot warning"></span>
							<span id="warning-count">0</span> Warnings
						</div>
						<div class="stat" style="color: var(--accent-blue); border-left: 3px solid var(--accent-blue);">
							<span class="status-dot info"></span>
							<span id="info-count">0</span> Info
						</div>
					</div>
				</div>

				<div id="code-issues-list"></div>
			</div>
		</div>
	</div>

	<script>
		const vscode = acquireVsCodeApi();
		let currentTab = 'main';
		let currentConflicts = [];
		let currentCodeIssues = [];

		// Handle messages from extension
		window.addEventListener('message', (event) => {
			const message = event.data;
			if (message.type === 'update') {
				updateUI(message.state, message.conflicts);
			} else if (message.type === 'conflicts') {
				currentConflicts = message.conflicts;
				updateConflicts(message.conflicts);
			} else if (message.type === 'showConflicts') {
				switchTab('conflicts');
			} else if (message.type === 'codeIssues') {
				currentCodeIssues = message.issues;
				updateCodeIssues(message.issues);
			} else if (message.type === 'notification') {
				showToast(message.message, message.notificationType);
			}
		});

		function switchTab(tab) {
			currentTab = tab;

			// Update tab buttons
			document.querySelectorAll('.tab').forEach(t => {
				t.classList.toggle('active', t.dataset.tab === tab);
			});

			// Show/hide content
			document.getElementById('tab-main').classList.toggle('hidden', tab !== 'main');
			document.getElementById('tab-conflicts').classList.toggle('hidden', tab !== 'conflicts');
			document.getElementById('tab-code').classList.toggle('hidden', tab !== 'code');

			// Animate cards
			if (tab === 'conflicts') {
				updateConflicts(currentConflicts);
			}
		}

		function updateUI(state, conflicts) {
			if (!state.hasRepo) {
				document.getElementById('no-repo').classList.remove('hidden');
				document.getElementById('repo-status').classList.add('hidden');
				return;
			}

			document.getElementById('no-repo').classList.add('hidden');
			document.getElementById('repo-status').classList.remove('hidden');

			// Update branch with animation
			const branchEl = document.getElementById('branch-name');
			branchEl.textContent = state.branch || 'No branch';
			branchEl.classList.add('animate-pulse');
			setTimeout(() => branchEl.classList.remove('animate-pulse'), 500);

			// Update sync status
			const aheadBadge = document.getElementById('ahead-badge');
			const behindBadge = document.getElementById('behind-badge');

			if (state.ahead > 0) {
				aheadBadge.textContent = '↑ ' + state.ahead + ' to send';
				aheadBadge.classList.remove('hidden');
			} else {
				aheadBadge.classList.add('hidden');
			}

			if (state.behind > 0) {
				behindBadge.textContent = '↓ ' + state.behind + ' to get';
				behindBadge.classList.remove('hidden');
			} else {
				behindBadge.classList.add('hidden');
			}

			// Update stats with animation
			animateCount('changed-count', state.changedFiles);
			animateCount('staged-count', state.stagedFiles);
			animateCount('conflict-count', state.conflictFiles);

			// Show/hide conflict stat
			const conflictStat = document.getElementById('conflict-stat');
			if (state.conflictFiles > 0) {
				conflictStat.classList.remove('hidden');
				conflictStat.classList.add('animate-pulse');
			} else {
				conflictStat.classList.add('hidden');
			}

			// Update file lists
			updateFileList('changed-files', state.modifiedFiles, 'M');
			updateFileList('staged-files', state.stagedFilesList, 'S');

			// Update conflicts
			currentConflicts = conflicts;
			if (conflicts && conflicts.length > 0 && currentTab === 'conflicts') {
				updateConflicts(conflicts);
			}
		}

		function animateCount(elementId, target) {
			const el = document.getElementById(elementId);
			const current = parseInt(el.textContent) || 0;
			if (current !== target) {
				el.classList.add('bump');
				el.style.transform = 'scale(1.3)';
				el.style.color = 'var(--accent-green)';
				el.textContent = target;
				setTimeout(() => {
					el.style.transform = 'scale(1)';
					el.style.color = '';
					el.classList.remove('bump');
				}, 300);
			}
		}

		function updateFileList(elementId, files, status) {
			const list = document.getElementById(elementId);
			list.innerHTML = '';

			if (!files || files.length === 0) {
				const emptyMsg = elementId === 'changed-files' ? 'No changes' : 'No staged files';
				list.innerHTML = '<li class="file-item" style="color: var(--text-secondary);">' + emptyMsg + '</li>';
				return;
			}

			files.forEach((file, index) => {
				const li = document.createElement('li');
				li.className = 'file-item animate-fade-in';
				li.style.animationDelay = (index * 0.05) + 's';
				li.innerHTML = '<span class="status-icon">' + (status === 'M' ? '📝' : '✅') + '</span> ' + file;
				li.onclick = () => {
					vscode.postMessage({ command: 'openFile', filePath: file });
				};
				list.appendChild(li);
			});
		}

		function updateConflicts(conflicts) {
			const section = document.getElementById('conflict-list');
			const progress = document.getElementById('conflict-progress');

			// Update progress dots
			progress.innerHTML = '';
			if (conflicts && conflicts.length > 0) {
				for (let i = 0; i < conflicts.length; i++) {
					const dot = document.createElement('div');
					dot.className = 'progress-dot' + (i === 0 ? ' active' : '');
					progress.appendChild(dot);
				}
				progress.classList.remove('hidden');
			} else {
				progress.classList.add('hidden');
			}

			if (!conflicts || conflicts.length === 0) {
				section.innerHTML = '<div class="empty-state"><span class="icon">✨</span><p>No conflicts!</p><p class="help-text">Your code is ready to merge</p></div>';
				return;
			}

			section.innerHTML = '';

			conflicts.forEach((conflict, index) => {
				const div = document.createElement('div');
				div.className = 'card conflict-card animate-fade-in';
				div.style.animationDelay = (index * 0.1) + 's';
				div.innerHTML = '
					<div class="card-header">
						<span class="icon">⚠️</span>
						<span class="conflict-title">' + getFileName(conflict.filePath) + '</span>
						<span style="color: var(--text-secondary); font-size: 11px;">Conflict ' + (index + 1) + ' of ' + conflicts.length + '</span>
					</div>
					<p style="margin: 8px 0;">' + conflict.explanation + '</p>
					<div class="code-block code-mine"><span style="color: var(--accent-yellow);">🟡 Your code</span><br>' + truncateCode(conflict.mine) + '</div>
					<div class="code-block code-theirs"><span style="color: var(--accent-blue);">🔵 Other person\'s code</span><br>' + truncateCode(conflict.theirs) + '</div>
					<p style="color: var(--accent-green); margin: 8px 0;">✅ ' + conflict.recommendation + '</p>
					<div class="btn-group">
						<button class="btn btn-green" onclick="resolveKeepMine(' + index + ')">Keep My Code</button>
						<button class="btn btn-primary" onclick="resolveKeepOther(' + index + ')">Use Other Code</button>
					</div>
				';
				section.appendChild(div);
			});
		}

		function updateCodeIssues(issues) {
			const list = document.getElementById('code-issues-list');

			if (!issues || issues.length === 0) {
				list.innerHTML = '<div class="empty-state"><span class="icon">✨</span><p>No issues found!</p><p class="help-text">Your code looks good</p></div>';
				return;
			}

			list.innerHTML = '';

			issues.forEach((issue, index) => {
				const div = document.createElement('div');
				div.className = 'issue-card animate-fade-in';
				div.style.animationDelay = (index * 0.05) + 's';
				div.onclick = () => {
					vscode.postMessage({ command: 'openFile', filePath: issue.filePath, line: issue.line });
				};
				div.innerHTML = '
					<div class="issue-header">
						<span class="issue-type ' + issue.severity + '">' + issue.severity.toUpperCase() + '</span>
						<span style="font-weight: 600;">' + issue.rule + '</span>
					</div>
					<div class="issue-message">' + issue.message + '</div>
					<div class="issue-location">' + getFileName(issue.filePath) + ':' + issue.line + '</div>
				';
				list.appendChild(div);
			});
		}

		function getFileName(filePath) {
			return filePath.split(/[\\\\/]/).pop();
		}

		function truncateCode(code, maxLines = 4) {
			const lines = code.split('\\n');
			if (lines.length <= maxLines) return code;
			return lines.slice(0, maxLines).join('\\n') + '\\n...';
		}

		// Toast Notifications
		function showToast(message, type = 'info') {
			const container = document.getElementById('toast-container');
			const toast = document.createElement('div');
			toast.className = 'toast toast-' + type;

			const icons = {
				success: '✓',
				error: '✕',
				info: 'ℹ'
			};

			toast.innerHTML = '<span>' + icons[type] + '</span> ' + message;
			container.appendChild(toast);

			// Auto-remove after 3 seconds
			setTimeout(() => {
				toast.style.animation = 'fadeIn 0.3s ease-out reverse';
				setTimeout(() => toast.remove(), 300);
			}, 3000);
		}

		// Celebration/Confetti effect
		function celebrate() {
			const colors = ['#4ec9b0', '#569cd6', '#dcdcaa', '#f14c4c', '#c586c0', '#ce9178'];
			const celebration = document.createElement('div');
			celebration.className = 'celebration';
			document.body.appendChild(celebration);

			for (let i = 0; i < 50; i++) {
				const confetti = document.createElement('div');
				confetti.className = 'confetti';
				confetti.style.left = Math.random() * 100 + '%';
				confetti.style.top = '100%';
				confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
				confetti.style.animationDelay = Math.random() * 0.5 + 's';
				confetti.style.transform = 'rotate(' + Math.random() * 360 + 'deg)';
				celebration.appendChild(confetti);
			}

			setTimeout(() => celebration.remove(), 1500);
		}

		// Loading state
		function setLoading(elementId, loading) {
			const el = document.getElementById(elementId);
			if (loading) {
				el.classList.add('skeleton');
				el.innerHTML = '<div class="skeleton skeleton-text"></div><div class="skeleton skeleton-text" style="width:80%"></div>';
			} else {
				el.classList.remove('skeleton');
			}
		}

		// Action functions
		function initRepo() { vscode.postMessage({ command: 'initRepo' }); }
		function refresh() { vscode.postMessage({ command: 'refresh' }); }
		function stageFile() { vscode.postMessage({ command: 'stageFile' }); }
		function unstageFile() { vscode.postMessage({ command: 'unstageFile' }); }
		function stageAll() { vscode.postMessage({ command: 'stageAll' }); showToast('All changes staged!', 'success'); }
		function unstageAll() { vscode.postMessage({ command: 'unstageAll' }); showToast('All changes unstaged!', 'info'); }
		function discard() { vscode.postMessage({ command: 'discard' }); }
		function commit() { vscode.postMessage({ command: 'commit' }); }
		function push() { vscode.postMessage({ command: 'push' }); showToast('Pushing code...', 'info'); }
		function pull() { vscode.postMessage({ command: 'pull' }); showToast('Pulling latest...', 'info'); }
		function fetch() { vscode.postMessage({ command: 'fetch' }); showToast('Refreshing...', 'info'); }
		function switchBranch() { vscode.postMessage({ command: 'switchBranch' }); }
		function createBranch() { vscode.postMessage({ command: 'createBranch' }); }
		function stash() { vscode.postMessage({ command: 'stash' }); showToast('Work stashed!', 'success'); }
		function stashPop() { vscode.postMessage({ command: 'stashPop' }); }
		function resolveKeepMine(index) { vscode.postMessage({ command: 'resolveKeepMine' }); showToast('Conflict resolved with your code!', 'success'); }
		function resolveKeepOther(index) { vscode.postMessage({ command: 'resolveKeepOther' }); showToast('Conflict resolved with other code!', 'success'); }
		function runCodeCheck() { vscode.postMessage({ command: 'runCodeCheck' }); showToast('Checking code...', 'info'); }
		function checkWorkspace() { vscode.postMessage({ command: 'checkWorkspace' }); showToast('Scanning workspace...', 'info'); }
		function autoFixIssues() { vscode.postMessage({ command: 'autoFixIssues' }); showToast('Applying auto fixes...', 'info'); }

		// Filter issues by severity
		let currentFilter = 'all';
		function filterIssues(severity) {
			currentFilter = severity;
			updateCodeIssues(currentCodeIssues);
		}

		// Enhanced code issues update with filtering and summary
		function updateCodeIssues(issues) {
			const list = document.getElementById('code-issues-list');

			// Filter issues
			let filteredIssues = issues;
			if (currentFilter !== 'all') {
				filteredIssues = issues.filter(i => i.severity === currentFilter);
			}

			// Update summary counts
			const errorCount = issues.filter(i => i.severity === 'error').length;
			const warningCount = issues.filter(i => i.severity === 'warning').length;
			const infoCount = issues.filter(i => i.severity === 'info').length;

			document.getElementById('error-count').textContent = errorCount;
			document.getElementById('warning-count').textContent = warningCount;
			document.getElementById('info-count').textContent = infoCount;

			// Animate counts
			['error-count', 'warning-count', 'info-count'].forEach(id => {
				const el = document.getElementById(id);
				el.classList.add('bump');
				setTimeout(() => el.classList.remove('bump'), 300);
			});

			if (!filteredIssues || filteredIssues.length === 0) {
				list.innerHTML = '<div class="empty-state"><span class="icon">✨</span><p>No ' + (currentFilter === 'all' ? 'issues' : currentFilter) + ' found!</p><p class="help-text">Your code looks good</p></div>';
				return;
			}

			list.innerHTML = '';

			filteredIssues.forEach((issue, index) => {
				const div = document.createElement('div');
				div.className = 'issue-card animate-fade-in hover-lift';
				div.style.animationDelay = (index * 0.05) + 's';
				div.onclick = () => {
					vscode.postMessage({ command: 'openFile', filePath: issue.filePath, line: issue.line });
				};
				div.innerHTML = '
					<div class="issue-header">
						<span class="issue-type ' + issue.severity + '">' + issue.severity.toUpperCase() + '</span>
						<span style="font-weight: 600;">' + issue.rule + '</span>
						<span class="mini-actions" style="margin-left: auto;">
							<button class="mini-btn" onclick="event.stopPropagation(); vscode.postMessage({command: 'fixIssue', issue: " + JSON.stringify(issue).replace(/"/g, '&quot;') + "})">Fix</button>
						</span>
					</div>
					<div class="issue-message">' + issue.message + '</div>
					<div class="issue-location">' + getFileName(issue.filePath) + ':' + issue.line + '</div>
				';
				list.appendChild(div);
			});
		}

		// Commit success celebration
		function showCommitSuccess() {
			celebrate();
			showToast('Changes committed successfully!', 'success');
		}
	</script>
</body>
</html>`;
	}
}
