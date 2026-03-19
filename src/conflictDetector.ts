import * as vscode from 'vscode';

export interface ConflictInfo {
	filePath: string;
	lineNumber: number;
	mine: string;
	theirs: string;
	explanation: string;
	recommendation: string;
	resolved: boolean;
}

interface ConflictBlock {
	startLine: number;
	endLine: number;
	mine: string;
	theirs: string;
}

export class ConflictDetector {
	private conflicts: Map<string, ConflictInfo[]> = new Map();

	detectConflicts(document: vscode.TextDocument): ConflictInfo[] {
		const filePath = document.uri.fsPath;
		const text = document.getText();
		const conflicts: ConflictInfo[] = [];

		const blocks = this.findConflictBlocks(text, document);

		for (const block of blocks) {
			const explanation = this.generateExplanation(block.mine, block.theirs);
			const recommendation = this.generateRecommendation(block.mine, block.theirs);

			conflicts.push({
				filePath,
				lineNumber: block.startLine,
				mine: block.mine,
				theirs: block.theirs,
				explanation,
				recommendation,
				resolved: false
			});
		}

		if (conflicts.length > 0) {
			this.conflicts.set(filePath, conflicts);
		}

		return conflicts;
	}

	private findConflictBlocks(text: string, document: vscode.TextDocument): ConflictBlock[] {
		const lines = text.split('\n');
		const blocks: ConflictBlock[] = [];

		let inConflict = false;
		let conflictStart = 0;
		let currentMine: string[] = [];
		let currentTheirs: string[] = [];
		let phase: 'mine' | 'theirs' = 'mine';

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];

			if (line.startsWith('<<<<<<<')) {
				inConflict = true;
				conflictStart = i;
				currentMine = [];
				currentTheirs = [];
				phase = 'mine';
			} else if (line.startsWith('=======') && inConflict) {
				phase = 'theirs';
			} else if (line.startsWith('>>>>>>>') && inConflict) {
				inConflict = false;
				blocks.push({
					startLine: conflictStart,
					endLine: i,
					mine: currentMine.join('\n').trim(),
					theirs: currentTheirs.join('\n').trim()
				});
			} else if (inConflict) {
				if (phase === 'mine') {
					currentMine.push(line);
				} else {
					currentTheirs.push(line);
				}
			}
		}

		return blocks;
	}

	getConflictsInWorkspace(): ConflictInfo[] {
		const allConflicts: ConflictInfo[] = [];
		this.conflicts.forEach((conflicts) => {
			allConflicts.push(...conflicts);
		});
		return allConflicts;
	}

	clearConflicts(filePath?: string) {
		if (filePath) {
			this.conflicts.delete(filePath);
		} else {
			this.conflicts.clear();
		}
	}

	async resolveCurrentConflict(document: vscode.TextDocument, choice: 'mine' | 'other'): Promise<void> {
		const filePath = document.uri.fsPath;
		const conflicts = this.conflicts.get(filePath);

		if (!conflicts || conflicts.length === 0) {
			// Try to detect conflicts first
			this.detectConflicts(document);
			return;
		}

		const edit = new vscode.WorkspaceEdit();
		const text = document.getText();
		const lines = text.split('\n');

		// Sort conflicts by line number (descending) to resolve from bottom to top
		const sortedConflicts = [...conflicts].sort((a, b) => b.lineNumber - a.lineNumber);

		for (const conflict of sortedConflicts) {
			if (conflict.resolved) continue;

			const chosenContent = choice === 'mine' ? conflict.mine : conflict.theirs;

			// Find and replace the conflict block
			const range = new vscode.Range(
				conflict.lineNumber,
				0,
				conflict.lineNumber + this.getConflictBlockHeight(conflict),
				0
			);

			edit.replace(document.uri, range, chosenContent);
		}

		await vscode.workspace.applyEdit(edit);

		// Clear resolved conflicts
		this.conflicts.delete(filePath);
	}

	private getConflictBlockHeight(conflict: ConflictInfo): number {
		// Rough estimate of conflict block height
		const mineLines = conflict.mine.split('\n').length;
		const theirsLines = conflict.theirs.split('\n').length;
		return Math.max(mineLines, theirsLines) + 3; // +3 for conflict markers
	}

	private generateExplanation(mine: string, theirs: string): string {
		const mineTrimmed = mine.trim();
		const theirsTrimmed = theirs.trim();

		// Check for safety checks
		if (theirsTrimmed.includes('&&') && !mineTrimmed.includes('&&')) {
			return 'Other person added an extra safety check.';
		}

		// Check for null/undefined checks
		if (theirsTrimmed.includes('null') || theirsTrimmed.includes('undefined')) {
			return 'Other person added a validation check.';
		}

		// Check for added lines
		if (theirsTrimmed.length > mineTrimmed.length) {
			return 'Other person added extra code.';
		}

		// Check for removed lines
		if (theirsTrimmed.length < mineTrimmed.length) {
			return 'Other person removed some code.';
		}

		// Check for different function calls
		if (mineTrimmed.includes('(') && theirsTrimmed.includes('(')) {
			return 'Different code was used here.';
		}

		return 'Both changed the same code differently.';
	}

	private generateRecommendation(mine: string, theirs: string): string {
		const mineTrimmed = mine.trim();
		const theirsTrimmed = theirs.trim();

		// If theirs has additional safety check, recommend theirs
		if (theirsTrimmed.includes('&&') && !mineTrimmed.includes('&&')) {
			return 'Use the safer version (other person\'s code).';
		}

		// If theirs has null check, recommend theirs
		if ((theirsTrimmed.includes('null') || theirsTrimmed.includes('undefined')) &&
			!(mineTrimmed.includes('null') || mineTrimmed.includes('undefined'))) {
			return 'Use the safer version (other person\'s code).';
		}

		// Default recommendation
		return 'Review both versions and choose the one that fits your needs.';
	}

	formatConflictForDisplay(conflict: ConflictInfo): string {
		return `
⚠ Conflict found

🟡 Your code
${this.truncateCode(conflict.mine)}

🔵 Other person's code
${this.truncateCode(conflict.theirs)}

💡 What changed
${conflict.explanation}

✅ Recommended
${conflict.recommendation}
`;
	}

	private truncateCode(code: string, maxLines: number = 5): string {
		const lines = code.split('\n');
		if (lines.length <= maxLines) {
			return code;
		}
		return lines.slice(0, maxLines).join('\n') + '\n... (click to see more)';
	}
}
