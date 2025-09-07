import { exec } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { promisify } from "node:util";
import * as vscode from "vscode";

const execAsync = promisify(exec);

export interface CachedActionParameter {
	key: string;
	description: string;
	envVar?: string;
	defaultValue?: string;
	required?: boolean;
}

export interface CachedActionInfo {
	name: string;
	description: string;
	parameters: CachedActionParameter[];
}

export interface CachedLaneInfo {
	name: string;
	platform: string;
	description: string;
}

export interface FastlaneCacheData {
	actions: CachedActionInfo[];
	lanes: CachedLaneInfo[];
	timestamp: string;
	version: string;
}

export class FastlaneDataManager {
	private workspaceRoot: string | null;
	private cacheDir: string;
	private cacheFile: string;

	constructor() {
		this.workspaceRoot = this.getWorkspaceRoot();
		if (this.workspaceRoot) {
			this.cacheDir = path.join(this.workspaceRoot, ".vscode", "fastlane-cache");
			this.cacheFile = path.join(this.cacheDir, "fastlane-data.json");
		} else {
			this.cacheDir = "";
			this.cacheFile = "";
		}
	}

	private getWorkspaceRoot(): string | null {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) return null;
		return workspaceFolders[0].uri.fsPath;
	}

	async initializeData(): Promise<void> {
		if (!this.workspaceRoot) {
			throw new Error("No workspace found");
		}

		// Use the Node.js script we created
		const scriptPath = path.join(__dirname, "..", "scripts", "init-fastlane-data.js");

		try {
			await execAsync(`node "${scriptPath}"`, {
				cwd: this.workspaceRoot,
				timeout: 120000, // 2 minutes timeout
			});
		} catch (error) {
			throw new Error(`Failed to initialize fastlane data: ${error}`);
		}
	}

	async refreshData(): Promise<void> {
		return this.initializeData();
	}

	getCachedData(): FastlaneCacheData | null {
		if (!this.cacheFile || !fs.existsSync(this.cacheFile)) {
			return null;
		}

		try {
			const content = fs.readFileSync(this.cacheFile, "utf8");
			const data = JSON.parse(content) as FastlaneCacheData;

			// Validate cache age (24 hours)
			const cacheTime = new Date(data.timestamp);
			const now = new Date();
			const hoursDiff = (now.getTime() - cacheTime.getTime()) / (1000 * 60 * 60);

			if (hoursDiff > 24) {
				console.warn("Fastlane cache is older than 24 hours, consider refreshing");
			}

			return data;
		} catch (error) {
			console.error("Failed to load cached fastlane data:", error);
			return null;
		}
	}

	isCacheValid(): boolean {
		if (!this.cacheFile || !fs.existsSync(this.cacheFile)) {
			return false;
		}

		try {
			const content = fs.readFileSync(this.cacheFile, "utf8");
			const data = JSON.parse(content) as FastlaneCacheData;

			// Check if cache is less than 24 hours old
			const cacheTime = new Date(data.timestamp);
			const now = new Date();
			const hoursDiff = (now.getTime() - cacheTime.getTime()) / (1000 * 60 * 60);

			return hoursDiff < 24;
		} catch (_error) {
			return false;
		}
	}

	getCacheStatus(): { exists: boolean; valid: boolean; age?: number } {
		if (!this.cacheFile || !fs.existsSync(this.cacheFile)) {
			return { exists: false, valid: false };
		}

		try {
			const content = fs.readFileSync(this.cacheFile, "utf8");
			const data = JSON.parse(content) as FastlaneCacheData;

			const cacheTime = new Date(data.timestamp);
			const now = new Date();
			const hoursDiff = (now.getTime() - cacheTime.getTime()) / (1000 * 60 * 60);

			return {
				exists: true,
				valid: hoursDiff < 24,
				age: hoursDiff,
			};
		} catch (_error) {
			return { exists: true, valid: false };
		}
	}
}
