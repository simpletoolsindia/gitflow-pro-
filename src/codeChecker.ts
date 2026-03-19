import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface CodeIssue {
	filePath: string;
	line: number;
	column: number;
	severity: 'error' | 'warning' | 'info';
	rule: string;
	message: string;
	fix?: string;
}

export class CodeChecker {
	private diagnosticCollection: vscode.DiagnosticCollection;

	constructor() {
		this.diagnosticCollection = vscode.languages.createDiagnosticCollection('simple-git-conflict-helper');
	}

	/**
	 * Check the current active file for issues
	 */
	async checkCurrentFile(): Promise<CodeIssue[]> {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showInformationMessage('No active file to check');
			return [];
		}

		const doc = editor.document;
		const issues: CodeIssue[] = [];

		// Run ESLint if available
		const eslintIssues = await this.runESLint(doc);
		issues.push(...eslintIssues);

		// Run TypeScript compiler check
		const tsIssues = await this.runTypeScriptCheck(doc);
		issues.push(...tsIssues);

		// Run basic code quality checks
		const basicIssues = this.runBasicChecks(doc);
		issues.push(...basicIssues);

		// Show diagnostics
		this.showDiagnostics(issues);

		return issues;
	}

	/**
	 * Check all workspace files
	 */
	async checkWorkspace(): Promise<CodeIssue[]> {
		const allIssues: CodeIssue[] = [];

		if (!vscode.workspace.workspaceFolders) {
			return allIssues;
		}

		for (const folder of vscode.workspace.workspaceFolders) {
			const files = await vscode.workspace.findFiles(
				new vscode.RelativePattern(folder, '**/*.{ts,tsx,js,jsx}'),
				'**/node_modules/**'
			);

			for (const file of files) {
				const doc = await vscode.workspace.openTextDocument(file);
				const issues = this.runBasicChecks(doc);
				allIssues.push(...issues);
			}
		}

		this.showDiagnostics(allIssues);
		return allIssues;
	}

	/**
	 * Run ESLint on a document
	 */
	private async runESLint(doc: vscode.TextDocument): Promise<CodeIssue[]> {
		const issues: CodeIssue[] = [];

		// Check if ESLint extension is available
		const eslintExtension = vscode.extensions.getExtension('dbaeumer.vscode-eslint');
		if (!eslintExtension) {
			return issues;
		}

		// Use ESLint's built-in diagnostics if available
		// This is a simplified version - in production you'd use the ESLint API directly
		try {
			const config = vscode.workspace.getConfiguration('eslint');
			const validate = config.get<string[]>('validate', ['javascript', 'javascriptreact']);

			if (validate.includes(doc.languageId) || validate.includes('typescript')) {
				// Get ESLint diagnostics from VS Code's built-in support
				const diagnostics = this.diagnosticCollection.get(doc.uri);
				if (diagnostics) {
					for (const diag of diagnostics) {
						issues.push({
							filePath: doc.uri.fsPath,
							line: diag.range.start.line + 1,
							column: diag.range.start.character + 1,
							severity: diag.severity === vscode.DiagnosticSeverity.Error ? 'error' :
								diag.severity === vscode.DiagnosticSeverity.Warning ? 'warning' : 'info',
							rule: 'ESLint',
							message: diag.message
						});
					}
				}
			}
		} catch (e) {
			// ESLint not configured
		}

		return issues;
	}

	/**
	 * Run TypeScript type checking
	 */
	private async runTypeScriptCheck(doc: vscode.TextDocument): Promise<CodeIssue[]> {
		const issues: CodeIssue[] = [];

		// Only check TypeScript files
		if (!doc.uri.fsPath.endsWith('.ts') && !doc.uri.fsPath.endsWith('.tsx')) {
			return issues;
		}

		// Check if TypeScript is available
		const tsExtension = vscode.extensions.getExtension('vscode.typescript-language-features');
		if (!tsExtension) {
			return issues;
		}

		// Get TypeScript diagnostics from VS Code's built-in support
		const tsDiagnostics = vscode.languages.getDiagnostics(doc.uri);
		for (const diag of tsDiagnostics) {
			const message = diag.message;
			// Filter out non-error diagnostics
			if (diag.severity === vscode.DiagnosticSeverity.Error ||
				diag.severity === vscode.DiagnosticSeverity.Warning) {
				issues.push({
					filePath: doc.uri.fsPath,
					line: diag.range.start.line + 1,
					column: diag.range.start.character + 1,
					severity: diag.severity === vscode.DiagnosticSeverity.Error ? 'error' : 'warning',
					rule: 'TypeScript',
					message: message
				});
			}
		}

		return issues;
	}

	/**
	 * Run basic code quality checks
	 */
	private runBasicChecks(doc: vscode.TextDocument): CodeIssue[] {
		const issues: CodeIssue[] = [];
		const lines = doc.getText().split('\n');
		const fileName = path.basename(doc.uri.fsPath);

		// Check for common issues
		lines.forEach((line, index) => {
			const lineNumber = index + 1;

			// Check for console.log (can be removed in production)
			if (/\bconsole\.(log|debug|info)\b/.test(line)) {
				issues.push({
					filePath: doc.uri.fsPath,
					line: lineNumber,
					column: line.indexOf('console') + 1,
					severity: 'warning',
					rule: 'no-console',
					message: 'Consider removing console statement for production code',
					fix: 'Remove console.log/debug/info statements'
				});
			}

			// Check for TODO comments
			if (/\bTODO\b/.test(line)) {
				issues.push({
					filePath: doc.uri.fsPath,
					line: lineNumber,
					column: line.indexOf('TODO') + 1,
					severity: 'info',
					rule: 'TODO',
					message: 'TODO comment found: ' + line.match(/\/\/\s*TODO[:\s]*(.*)/)?.[1] || ''
				});
			}

			// Check for FIXME comments
			if (/\bFIXME\b/.test(line)) {
				issues.push({
					filePath: doc.uri.fsPath,
					line: lineNumber,
					column: line.indexOf('FIXME') + 1,
					severity: 'warning',
					rule: 'FIXME',
					message: 'FIXME comment found - this needs to be fixed'
				});
			}

			// Check for trailing whitespace
			if (/\s+$/.test(line) && line.trim().length > 0) {
				issues.push({
					filePath: doc.uri.fsPath,
					line: lineNumber,
					column: line.length - (line.match(/\s+$/)?.[0].length || 0) + 1,
					severity: 'info',
					rule: 'no-trailing-spaces',
					message: 'Trailing whitespace found'
				});
			}

			// Check for very long lines
			if (line.length > 120) {
				issues.push({
					filePath: doc.uri.fsPath,
					line: lineNumber,
					column: 1,
					severity: 'info',
					rule: 'max-len',
					message: 'Line exceeds 120 characters (' + line.length + ')'
				});
			}

			// Check for empty catch blocks
			emptyCatchRegex.lastIndex = 0;
			if (emptyCatchRegex.test(line)) {
				issues.push({
					filePath: doc.uri.fsPath,
					line: lineNumber,
					column: line.indexOf('catch') + 1,
					severity: 'warning',
					rule: 'no-empty',
					message: 'Empty catch block - errors are being silently ignored'
				});
			}

			// Check for hardcoded credentials (basic check)
			if (/(password|secret|api[_-]?key|token)\s*=\s*['"][^'"]+['"]/i.test(line)) {
				issues.push({
					filePath: doc.uri.fsPath,
					line: lineNumber,
					column: line.indexOf('=') + 1,
					severity: 'error',
					rule: 'no-hardcoded-credentials',
					message: 'Potential hardcoded credential detected'
				});
			}
		});

		// Check for missing error handling in async functions
		const text = doc.getText();
		if (/\basync\s+function\b/.test(text) && !/\btry\s*\{/.test(text)) {
			issues.push({
				filePath: doc.uri.fsPath,
				line: 1,
				column: 1,
				severity: 'warning',
				rule: 'require-await',
				message: 'Async function should use try-catch for error handling'
			});
		}

		return issues;
	}

	/**
	 * Show diagnostics in the Problems panel
	 */
	private showDiagnostics(issues: CodeIssue[]): void {
		const diagnosticsMap = new Map<vscode.Uri, vscode.Diagnostic[]>();

		for (const issue of issues) {
			const uri = vscode.Uri.file(issue.filePath);
			const range = new vscode.Range(
				issue.line - 1,
				issue.column - 1,
				issue.line - 1,
				issue.column + 10
			);

			const diagnostic = new vscode.Diagnostic(range, issue.message,
				issue.severity === 'error' ? vscode.DiagnosticSeverity.Error :
					issue.severity === 'warning' ? vscode.DiagnosticSeverity.Warning :
						vscode.DiagnosticSeverity.Information
			);

			diagnostic.source = issue.rule;

			const existing = diagnosticsMap.get(uri) || [];
			existing.push(diagnostic);
			diagnosticsMap.set(uri, existing);
		}

		this.diagnosticCollection.set([...diagnosticsMap.entries()]);
	}

	/**
	 * Fix a specific issue
	 */
	async fixIssue(issue: CodeIssue): Promise<void> {
		if (!issue.fix) {
			vscode.window.showInformationMessage('No automatic fix available for this issue');
			return;
		}

		const doc = await vscode.workspace.openTextDocument(issue.filePath);
		const edit = new vscode.WorkspaceEdit();

		switch (issue.rule) {
			case 'no-console':
				// Find and remove console statements
				const lines = doc.getText().split('\n');
				const targetLine = lines[issue.line - 1];
				const fullRange = new vscode.Range(
					issue.line - 1, 0,
					issue.line - 1, targetLine.length
				);
				edit.delete(doc.uri, fullRange);
				break;

			case 'no-trailing-spaces':
				const lineText = doc.lineAt(issue.line - 1).text;
				const trimmedEnd = lineText.trimEnd();
				const trailingRange = new vscode.Range(
					issue.line - 1, trimmedEnd.length,
					issue.line - 1, lineText.length
				);
				edit.delete(doc.uri, trailingRange);
				break;

			case 'TODO':
			case 'FIXME':
				const commentLine = doc.lineAt(issue.line - 1).text;
				const commentRange = new vscode.Range(
					issue.line - 1, 0,
					issue.line - 1, commentLine.length
				);
				edit.delete(doc.uri, commentRange);
				break;

			default:
				vscode.window.showInformationMessage('Automatic fix not implemented for ' + issue.rule);
				return;
		}

		await vscode.workspace.applyEdit(edit);
		await doc.save();
	}

	/**
	 * Auto-fix all fixable issues
	 */
	async autoFixAll(): Promise<void> {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}

		const doc = editor.document;
		const fixes: { line: number; startCol: number; endCol: number; text: string }[] = [];

		const lines = doc.getText().split('\n');
		lines.forEach((line, index) => {
			const lineNumber = index + 1;

			// Fix trailing whitespace
			if (/\s+$/.test(line) && line.trim().length > 0) {
				fixes.push({
					line: lineNumber,
					startCol: line.trimEnd().length + 1,
					endCol: line.length + 1,
					text: ''
				});
			}

			// Mark TODO/FIXME for removal
			if (/\b(TODO|FIXME)\b/.test(line)) {
				fixes.push({
					line: lineNumber,
					startCol: 1,
					endCol: line.length + 1,
					text: ''
				});
			}
		});

		if (fixes.length > 0) {
			const response = await vscode.window.showInformationMessage(
				`Found ${fixes.length} auto-fixable issues. Apply fixes?`,
				'Fix All',
				'Cancel'
			);

			if (response === 'Fix All') {
				const edit = new vscode.WorkspaceEdit();
				for (const fix of fixes) {
					const range = new vscode.Range(
						fix.line - 1, fix.startCol - 1,
						fix.line - 1, fix.endCol - 1
					);
					edit.delete(doc.uri, range);
				}
				await vscode.workspace.applyEdit(edit);
				await doc.save();
			}
		} else {
			vscode.window.showInformationMessage('No auto-fixable issues found');
		}
	}

	/**
	 * Enable/disable auto-check on save
	 */
	setAutoCheck(enabled: boolean): void {
		if (enabled) {
			vscode.workspace.onDidSaveTextDocument(async (doc) => {
				await this.checkCurrentFile();
			});
			vscode.window.showInformationMessage('Auto code check enabled');
		} else {
			this.diagnosticCollection.clear();
			vscode.window.showInformationMessage('Auto code check disabled');
		}
	}

	/**
	 * Clean up resources
	 */
	dispose(): void {
		this.diagnosticCollection.dispose();
	}
}

// Regex for empty catch blocks
const emptyCatchRegex = /catch\s*\([^)]*\)\s*\{\s*\}/;
