import { exec } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { promisify } from "node:util";
import * as vscode from "vscode";
import {
	type CachedActionInfo,
	type CachedLaneInfo,
	FastlaneDataManager,
} from "./fastlane-data-manager";
import { ACCURATE_ACTION_DEFINITIONS, generateSnippetForAction } from "./action-definitions";

const execAsync = promisify(exec);

interface ActionParameter {
	key: string;
	description: string;
	envVar?: string;
	defaultValue?: string;
	required?: boolean;
}

interface ActionInfo {
	name: string;
	description: string;
	parameters: ActionParameter[];
}

export class FastlaneCompletionProvider implements vscode.CompletionItemProvider {
	private allActions: vscode.CompletionItem[] = [];
	private actionInfoCache: Map<string, ActionInfo> = new Map();
	private dataManager: FastlaneDataManager;

	constructor() {
		this.dataManager = new FastlaneDataManager();
		this.loadAllActions();
	}

	provideCompletionItems(
		document: vscode.TextDocument,
		position: vscode.Position
	): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
		// Don't suggest actions if we're inside function parameters
		if (this.isInsideActionParameters(document, position)) {
			return [];
		}

		// Check if we're inside a lane definition or at the top level
		if (this.isInsideLaneDefinition(document, position) || this.isTopLevel(document, position)) {
			console.log(`Providing ${this.allActions.length} actions for completion`);
			return this.allActions;
		}

		return [];
	}

	private isInsideActionParameters(
		document: vscode.TextDocument,
		position: vscode.Position
	): boolean {
		const line = document.lineAt(position);
		const lineText = line.text.substring(0, position.character);

		console.log(`isInsideActionParameters check: "${lineText}"`);

		// Look for action patterns followed by opening parenthesis
		// This should only block completion when we're clearly inside action parameters
		const actionCallPattern = /([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\s*([^)]*?)$/;
		const match = lineText.match(actionCallPattern);

		if (match) {
			const actionName = match[1];
			const parameterContent = match[2];

			console.log(`Found action call: ${actionName}, params: "${parameterContent}"`);

			// Only block if we're clearly inside parameters (not at the start)
			// Allow completion at the very beginning of parameters
			if (parameterContent.trim().length > 0) {
				return true;
			}
		}

		return false;
	}

	private isTopLevel(document: vscode.TextDocument, position: vscode.Position): boolean {
		const line = document.lineAt(position);
		const lineText = line.text.substring(0, position.character);
		const trimmedText = lineText.trim();

		console.log(`isTopLevel check: line="${lineText}", trimmed="${trimmedText}"`);

		// Allow completions in these cases:
		// 1. Empty line or just whitespace
		// 2. Line starts with typical action patterns (letters followed by optional underscore/letters)
		// 3. After certain keywords or punctuation that suggests a new statement

		if (trimmedText.length === 0 || lineText.endsWith(" ")) {
			return true;
		}

		// Check if we're in the middle of typing an action name
		// Allow completion if the current word looks like an action name
		const currentWord = this.getCurrentWord(lineText, position.character);
		if (currentWord && /^[a-zA-Z][a-zA-Z0-9_]*$/.test(currentWord)) {
			return true;
		}

		// Allow after common statement endings
		if (
			lineText.endsWith(")") ||
			lineText.endsWith(",") ||
			lineText.endsWith("\n") ||
			lineText.endsWith(";")
		) {
			return true;
		}

		return false;
	}

	private getCurrentWord(lineText: string, position: number): string {
		let start = position;
		let end = position;

		// Find the start of the current word
		while (start > 0 && /[a-zA-Z0-9_]/.test(lineText[start - 1])) {
			start--;
		}

		// Find the end of the current word
		while (end < lineText.length && /[a-zA-Z0-9_]/.test(lineText[end])) {
			end++;
		}

		return lineText.substring(start, end);
	}

	private formatDefaultValue(value: string): string {
		// Try to infer the correct type for the default value
		if (!value) return '""';

		// Check for boolean values
		if (value.toLowerCase() === "true" || value.toLowerCase() === "false") {
			return value.toLowerCase();
		}

		// Check for numeric values
		if (/^\d+$/.test(value)) {
			return value;
		}

		// Check for arrays
		if (value.startsWith("[") && value.endsWith("]")) {
			return value;
		}

		// Check for hashes/objects
		if (value.startsWith("{") && value.endsWith("}")) {
			return value;
		}

		// Default to string
		return `"${value}"`;
	}

	private getShortParameterName(key: string, description?: string, actionName?: string): string {
		// Action-specific mappings for better placeholders
		const actionSpecificMappings: Record<string, Record<string, string>> = {
			build_app: {
				workspace: "path/to/App.xcworkspace",
				project: "path/to/App.xcodeproj",
				scheme: "YourScheme",
				export_method: "app-store",
				configuration: "Release",
				output_directory: "./build",
				output_name: "App",
			},
			match: {
				type: "development",
				app_identifier: "com.yourcompany.app",
				git_url: "https://github.com/user/certs.git",
				username: "your.email@company.com",
				team_id: "XXXXXXXXXX",
				readonly: "false",
				storage_mode: "git",
			},
			upload_to_testflight: {
				username: "your.email@company.com",
				app_identifier: "com.yourcompany.app",
				team_id: "XXXXXXXXXX",
				ipa: "./build/App.ipa",
				skip_waiting_for_build_processing: "true",
			},
			gradle: {
				project_dir: "./android",
				tasks: "assembleRelease",
				properties: "{}",
				gradle_path: "./gradlew",
			},
			firebase_app_distribution: {
				app: "1:123456789:ios:abcd1234",
				ipa_path: "./build/App.ipa",
				apk_path: "./app/build/outputs/apk/release/app-release.apk",
				groups: "internal-testers",
				release_notes: "New build available for testing",
			},
			upload_to_play_store: {
				package_name: "com.yourcompany.app",
				track: "internal",
				json_key: "./android/key.json",
				aab: "./android/app/build/outputs/bundle/release/app-release.aab",
			},
		};

		// Check action-specific mappings first
		if (
			actionName &&
			actionSpecificMappings[actionName] &&
			actionSpecificMappings[actionName][key]
		) {
			return actionSpecificMappings[actionName][key];
		}

		// Generic common mappings
		const commonMappings: Record<string, string> = {
			app_identifier: "com.company.app",
			workspace: "path/to/workspace",
			scheme: "scheme_name",
			export_method: "app-store",
			type: "development",
			readonly: "false",
			username: "your.email@company.com",
			password: "password",
			team_id: "XXXXXXXXXX",
			project_dir: "./project",
			tasks: "build_task",
			track: "internal",
			package_name: "com.company.app",
			version: "1.0.0",
			initial_build_number: "1",
			platform: "ios",
			api_key_path: "path/to/key.json",
			api_key: "api_key_info",
			git_url: "https://github.com/user/repo.git",
			storage_mode: "git",
			keychain_name: "login.keychain",
		};

		if (commonMappings[key]) {
			return commonMappings[key];
		}

		// Use the key itself if it's short
		if (key.length <= 10) {
			return key;
		}

		// Use first word of description if available and short
		if (description) {
			const firstWord = description.split(" ")[0];
			if (firstWord.length <= 15) {
				return firstWord.toLowerCase();
			}
		}

		// Fallback to shortened key
		return key.substring(0, 10);
	}

	private async loadAllActions(): Promise<void> {
		const allActions: vscode.CompletionItem[] = [];

		// Try to load from cache first
		const cachedData = this.dataManager.getCachedData();

		if (cachedData) {
			console.log("Loading fastlane data from cache");

			// Load cached actions
			const cachedActions = this.loadActionsFromCache(cachedData.actions);
			allActions.push(...cachedActions);

			// Load cached lanes
			const cachedLanes = this.loadLanesFromCache(cachedData.lanes);
			allActions.push(...cachedLanes);

			// Show notification if cache is getting old
			const cacheStatus = this.dataManager.getCacheStatus();
			if (cacheStatus.age && cacheStatus.age > 12) {
				vscode.window
					.showInformationMessage(
						'Fastlane cache is getting old. Consider running "Fastlane Autocomplete: Refresh Data" command.',
						"Refresh Now"
					)
					.then((selection) => {
						if (selection === "Refresh Now") {
							vscode.commands.executeCommand("fastlane-autocomplete.refreshData");
						}
					});
			}
		} else {
			console.log("No cache found, falling back to CLI/hardcoded data");

			try {
				// Load real fastlane actions using CLI (fallback)
				const fastlaneActions = await this.loadFastlaneActionsFromCLI();
				allActions.push(...fastlaneActions);

				// Load existing lanes from Fastfile using CLI
				const laneActions = await this.loadLanesFromCLI();
				allActions.push(...laneActions);

				// Fallback to hardcoded standard actions if CLI fails
				if (fastlaneActions.length === 0) {
					const standardActions = await this.loadStandardFastlaneActions();
					allActions.push(...standardActions);
				}

				// Show notification to init cache
				vscode.window
					.showInformationMessage(
						"Initialize Fastlane data cache for better performance?",
						"Initialize Now"
					)
					.then((selection) => {
						if (selection === "Initialize Now") {
							vscode.commands.executeCommand("fastlane-autocomplete.initData");
						}
					});
			} catch (error) {
				console.warn("Failed to load actions from fastlane CLI, using fallback:", error);
				// Fallback to existing implementation
				const standardActions = await this.loadStandardFastlaneActions();
				allActions.push(...standardActions);

				const laneActions = await this.loadExistingLanes();
				allActions.push(...laneActions);
			}
		}

		this.allActions = allActions;
	}

	private loadActionsFromCache(cachedActions: CachedActionInfo[]): vscode.CompletionItem[] {
		const actions: vscode.CompletionItem[] = [];

		console.log(`Loading ${cachedActions.length} actions from cache`);

		for (const cachedAction of cachedActions) {
			console.log(
				`Processing cached action: ${cachedAction.name} with ${cachedAction.parameters?.length || 0} parameters`
			);

			const item = new vscode.CompletionItem(cachedAction.name, vscode.CompletionItemKind.Function);
			item.detail = "Fastlane Action (Cached)";
			item.documentation = cachedAction.description;

			if (cachedAction.parameters && cachedAction.parameters.length > 0) {
				// Prioritize required parameters, then important optional ones
				const requiredParams = cachedAction.parameters.filter((p) => p.required);
				const optionalParams = cachedAction.parameters.filter((p) => !p.required);

				// Limit to most essential parameters (3-5 typically)
				const selectedParams = [...requiredParams, ...optionalParams].slice(0, 5);

				console.log(
					`[${cachedAction.name}] Selected parameters:`,
					selectedParams.map((p) => `${p.key}(${p.required ? "required" : "optional"})`)
				);

				const paramSnippets = selectedParams
					.map((param, index) => {
						// Use the action-aware parameter name method
						const shortDesc = this.getShortParameterName(
							param.key,
							param.description,
							cachedAction.name
						);
						const placeholder = `\${${index + 1}:${shortDesc}}`;
						return `${param.key}: ${placeholder}`;
					})
					.join(",\n  ");

				item.insertText = new vscode.SnippetString(`${cachedAction.name}(\n  ${paramSnippets}\n)`);
				console.log(`[${cachedAction.name}] Generated snippet:`, item.insertText.value);
			} else {
				item.insertText = new vscode.SnippetString(
					`${cachedAction.name}(\n  \${1:# parameters}\n)`
				);
				console.log(`[${cachedAction.name}] No parameters, using generic snippet`);
			}

			actions.push(item);
		}

		return actions;
	}

	private loadLanesFromCache(cachedLanes: CachedLaneInfo[]): vscode.CompletionItem[] {
		const lanes: vscode.CompletionItem[] = [];

		for (const cachedLane of cachedLanes) {
			const item = new vscode.CompletionItem(cachedLane.name, vscode.CompletionItemKind.Method);
			item.detail = `Lane (${cachedLane.platform}) - Cached`;
			item.documentation = cachedLane.description;
			item.insertText = new vscode.SnippetString(`${cachedLane.name}(\${1:options})`);
			lanes.push(item);
		}

		return lanes;
	}

	private async loadFastlaneActionsFromCLI(): Promise<vscode.CompletionItem[]> {
		const workspaceRoot = this.getWorkspaceRoot();
		if (!workspaceRoot) return [];

		try {
			const { stdout } = await execAsync("fastlane actions", {
				cwd: workspaceRoot,
				timeout: 10000,
				env: { ...process.env, COLUMNS: "200" },
			});

			const basicActions = this.parseActionsFromCLIOutput(stdout);

			// Pre-load parameter info for commonly used actions
			const commonActions = [
				"build_app",
				"match",
				"upload_to_testflight",
				"gradle",
				"upload_to_play_store",
				"firebase_app_distribution",
			];
			const enhancedActions: vscode.CompletionItem[] = [];

			for (const action of basicActions) {
				const actionName = typeof action.label === "string" ? action.label : action.label.label;
				if (commonActions.includes(actionName)) {
					// Load parameter info for common actions
					const enhancedAction = await this.createParameterizedCompletion(actionName);
					enhancedActions.push(enhancedAction);
				} else {
					// Keep basic completion for other actions
					action.insertText = new vscode.SnippetString(`${actionName}(\n  \${1:# parameters}\n)`);
					enhancedActions.push(action);
				}
			}

			return enhancedActions;
		} catch (error) {
			console.warn("Failed to get fastlane actions:", error);
			return [];
		}
	}

	private async loadLanesFromCLI(): Promise<vscode.CompletionItem[]> {
		const workspaceRoot = this.getWorkspaceRoot();
		if (!workspaceRoot) return [];

		try {
			const { stdout } = await execAsync("fastlane lanes --json", {
				cwd: workspaceRoot,
				timeout: 10000,
			});

			return this.parseLanesFromJSON(stdout);
		} catch (error) {
			console.warn("Failed to get fastlane lanes:", error);
			// Fallback to file-based parsing
			return this.loadExistingLanes();
		}
	}

	private getWorkspaceRoot(): string | null {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) return null;
		return workspaceFolders[0].uri.fsPath;
	}

	private parseActionsFromCLIOutput(output: string): vscode.CompletionItem[] {
		const actions: vscode.CompletionItem[] = [];
		const lines = output.split("\n");

		for (const line of lines) {
			// Parse fastlane actions table format
			// Lines with actions start with | and contain action names
			if (
				line.includes("|") &&
				!line.includes("Action") &&
				!line.includes("---") &&
				!line.includes("+")
			) {
				const parts = line.split("|").map((part) => part.trim());
				if (parts.length >= 2 && parts[1]) {
					// Remove ANSI color codes and extract action name
					const actionName = parts[1].replace(/\x1b\[[0-9;]*m/g, "").trim();
					const description =
						parts.length > 2 ? parts[2].replace(/\x1b\[[0-9;]*m/g, "").trim() : "";

					if (actionName && /^[a-zA-Z][a-zA-Z0-9_]*$/.test(actionName) && actionName !== "") {
						const item = new vscode.CompletionItem(actionName, vscode.CompletionItemKind.Function);
						item.detail = "Fastlane Action";
						item.documentation = description || `Available fastlane action: ${actionName}`;

						// Basic insertion - will be enhanced for common actions

						actions.push(item);
					}
				}
			}
		}

		return actions;
	}

	private async getActionInfo(actionName: string): Promise<ActionInfo | null> {
		// Check cache first
		if (this.actionInfoCache.has(actionName)) {
			const cached = this.actionInfoCache.get(actionName);
			if (cached) {
				console.log(`Using cached action info for ${actionName}`);
				return cached;
			}
		}

		const workspaceRoot = this.getWorkspaceRoot();
		if (!workspaceRoot) return null;

		console.log(`Fetching fresh action info for ${actionName}`);
		try {
			const { stdout } = await execAsync(`fastlane action ${actionName}`, {
				cwd: workspaceRoot,
				timeout: 10000,
				env: { ...process.env, COLUMNS: "200" },
			});

			const actionInfo = this.parseActionInfo(actionName, stdout);
			if (actionInfo) {
				// Cache the result with action name as key to ensure uniqueness
				this.actionInfoCache.set(actionName, actionInfo);
				console.log(
					`Cached action info for ${actionName} with ${actionInfo.parameters.length} parameters`
				);
				return actionInfo;
			}
		} catch (error) {
			console.warn(`Failed to get info for action ${actionName}:`, error);
		}

		return null;
	}

	private parseActionInfo(actionName: string, output: string): ActionInfo | null {
		const lines = output.split("\n");
		const parameters: ActionParameter[] = [];
		let description = "";
		let inParametersSection = false;
		let sectionHeaderFound = false;

		console.log(`=== Parsing action info for ${actionName} ===`);

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];

			// Extract description from action header
			if (!inParametersSection && line.includes("|") && line.includes(actionName)) {
				// Look for description in the next few lines
				for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
					const descLine = lines[j];
					if (descLine.includes("|") && !descLine.includes("---") && !descLine.includes("+")) {
						const cleanDesc = descLine
							.replace(/\x1b\[[0-9;]*m/g, "")
							.replace(/^\||\|$/g, "")
							.trim();
						if (
							cleanDesc &&
							!cleanDesc.includes("More information") &&
							!cleanDesc.includes("Created by") &&
							!cleanDesc.includes("Author")
						) {
							description = cleanDesc;
							break;
						}
					}
				}
			}

			// Look for parameter section headers more specifically
			if (
				line.includes("Options") &&
				!line.includes("Output") &&
				!line.includes("Return") &&
				(line.includes("Description") || line.includes("Environment") || line.includes("Default"))
			) {
				inParametersSection = true;
				sectionHeaderFound = true;
				console.log(`[${actionName}] Found parameter section at line ${i}: ${line}`);
				continue;
			}

			// Reset if we hit Output Variables or Return Value sections
			if (
				inParametersSection &&
				(line.includes("Output Variables") ||
					line.includes("Return Value") ||
					(line.includes("Output") && line.includes("Variables")))
			) {
				console.log(
					`[${actionName}] Stopping parameter parsing - found output section at: ${line}`
				);
				inParametersSection = false;
				break;
			}

			// Parse parameter rows
			if (inParametersSection && line.includes("|")) {
				// Skip header separator lines
				if (line.includes("---") || line.includes("===") || line.includes("+++")) {
					continue;
				}

				const parts = line
					.split("|")
					.map((part) => part.replace(/\x1b\[[0-9;]*m/g, "").trim())
					.filter((part) => part !== "");

				console.log(`[${actionName}] Parsing parameter line: ${line}`);
				console.log(`[${actionName}] Parts:`, parts);

				if (parts.length >= 2) {
					const key = parts[0];
					const desc = parts[1] || "";
					const envVar = parts.length > 2 ? parts[2] : "";
					const defaultVal = parts.length > 3 ? parts[3] : "";

					// More flexible key validation - exclude table headers
					if (
						key &&
						key !== "" &&
						key !== "Key" &&
						/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key) &&
						!key.includes("Description") &&
						!key.includes("Env") &&
						!key.includes("Default")
					) {
						// Action-specific required parameter detection
						const isRequired = this.isParameterRequired(actionName, key, defaultVal, envVar);

						const param: ActionParameter = {
							key,
							description: desc,
							envVar: envVar || undefined,
							defaultValue: defaultVal && defaultVal !== "*" ? defaultVal : undefined,
							required: isRequired,
						};

						parameters.push(param);
						console.log(`[${actionName}] Added parameter:`, param);
					}
				}
			}

			// Stop parsing if we hit another section
			if (
				inParametersSection &&
				sectionHeaderFound &&
				(line.includes("More information") ||
					line.includes("Lane Variables") ||
					line.includes("Output Variables") ||
					line.includes("Return Value"))
			) {
				console.log(`[${actionName}] Stopping parameter parsing at: ${line}`);
				break;
			}
		}

		console.log(`=== Parsed ${parameters.length} parameters for ${actionName} ===`);

		return {
			name: actionName,
			description: description || `Fastlane action: ${actionName}`,
			parameters,
		};
	}

	private isParameterRequired(
		actionName: string,
		key: string,
		defaultVal: string,
		envVar: string
	): boolean {
		// Action-specific required parameter mappings
		const requiredParams: Record<string, string[]> = {
			build_app: ["scheme"],
			match: ["type", "app_identifier"],
			upload_to_testflight: ["app_identifier"],
			gradle: ["tasks"],
			upload_to_play_store: ["package_name", "track"],
			firebase_app_distribution: ["app"],
			get_version_number: [],
			latest_testflight_build_number: ["app_identifier"],
		};

		// Check if parameter is explicitly required for this action
		if (requiredParams[actionName] && requiredParams[actionName].includes(key)) {
			return true;
		}

		// General required parameter detection logic
		return defaultVal === "*" || (!defaultVal && !envVar);
	}

	private async createParameterizedCompletion(actionName: string): Promise<vscode.CompletionItem> {
		const actionInfo = await this.getActionInfo(actionName);
		const item = new vscode.CompletionItem(actionName, vscode.CompletionItemKind.Function);

		item.detail = "Fastlane Action";
		item.documentation = actionInfo?.description || `Available fastlane action: ${actionName}`;

		console.log(
			`Creating parameterized completion for ${actionName} with ${actionInfo?.parameters?.length || 0} parameters`
		);

		if (actionInfo && actionInfo.parameters.length > 0) {
			// Prioritize required parameters, then important optional ones
			const requiredParams = actionInfo.parameters.filter((p) => p.required);
			const optionalParams = actionInfo.parameters.filter((p) => !p.required);

			// Limit to most essential parameters (3-5 typically)
			const selectedParams = [...requiredParams, ...optionalParams].slice(0, 5);

			console.log(
				`[${actionName}] Selected parameters for completion:`,
				selectedParams.map((p) => `${p.key}(${p.required ? "required" : "optional"})`)
			);

			const paramSnippets = selectedParams
				.map((param, index) => {
					// Use consistent parameter naming logic
					const shortDesc = this.getShortParameterName(param.key, param.description, actionName);
					const placeholder = `\${${index + 1}:${shortDesc}}`;
					return `${param.key}: ${placeholder}`;
				})
				.join(",\n  ");

			item.insertText = new vscode.SnippetString(`${actionName}(\n  ${paramSnippets}\n)`);
			console.log(`[${actionName}] CLI completion snippet:`, item.insertText.value);
		} else {
			item.insertText = new vscode.SnippetString(`${actionName}(\n  \${1:# parameters}\n)`);
			console.log(`[${actionName}] No parameters found, using generic snippet`);
		}

		return item;
	}

	private parseLanesFromJSON(jsonOutput: string): vscode.CompletionItem[] {
		const lanes: vscode.CompletionItem[] = [];

		try {
			const lanesData = JSON.parse(jsonOutput);

			// Parse lanes from JSON structure
			for (const [platform, platformLanes] of Object.entries(lanesData as Record<string, any>)) {
				if (typeof platformLanes === "object" && platformLanes) {
					for (const [laneName, laneInfo] of Object.entries(platformLanes)) {
						const item = new vscode.CompletionItem(laneName, vscode.CompletionItemKind.Method);
						item.detail = `Lane (${platform})`;

						const description = (laneInfo as any)?.description || "";
						item.documentation = description
							? `${description} [Platform: ${platform}]`
							: `Lane: ${laneName} [Platform: ${platform}]`;
						item.insertText = new vscode.SnippetString(`${laneName}(\${1:options})`);
						lanes.push(item);
					}
				}
			}
		} catch (error) {
			console.warn("Failed to parse lanes JSON:", error);
		}

		return lanes;
	}

	private async loadExistingLanes(): Promise<vscode.CompletionItem[]> {
		const fastfilePath = this.findFastfilePath();
		if (!fastfilePath || !fs.existsSync(fastfilePath)) {
			return [];
		}

		const content = fs.readFileSync(fastfilePath, "utf8");
		return this.parseLanes(content);
	}

	private findFastfilePath(): string | null {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) return null;

		// Try to find Fastfile in fastlane directory
		for (const folder of workspaceFolders) {
			const fastlaneDir = path.join(folder.uri.fsPath, "fastlane");
			if (fs.existsSync(fastlaneDir)) {
				const fastfilePath = path.join(fastlaneDir, "Fastfile");
				if (fs.existsSync(fastfilePath)) {
					return fastfilePath;
				}
			}
		}

		return null;
	}

	private parseLanes(content: string): vscode.CompletionItem[] {
		const laneActions: vscode.CompletionItem[] = [];
		const laneRegex = /(?:^|\n)\s*(?:private_)?lane\s+:(\w+)/g;
		let match: RegExpExecArray | null;

		// biome-ignore lint/suspicious/noAssignInExpressions: Standard pattern for regex exec loops
		while ((match = laneRegex.exec(content)) !== null) {
			const laneName = match[1];
			const item = new vscode.CompletionItem(laneName, vscode.CompletionItemKind.Method);
			item.detail = "Existing Lane";
			item.documentation = `Call existing lane: ${laneName}`;
			item.insertText = new vscode.SnippetString(`${laneName}(\${1:options})`);
			laneActions.push(item);
		}

		return laneActions;
	}

	// Removed - now using CLI-based approach instead of manual plugin parsing

	private async loadStandardFastlaneActions(): Promise<vscode.CompletionItem[]> {
		const actions: vscode.CompletionItem[] = [];

		// Load actions from accurate definitions first
		for (const [actionName, actionDef] of Object.entries(ACCURATE_ACTION_DEFINITIONS)) {
			const item = new vscode.CompletionItem(actionName, vscode.CompletionItemKind.Function);
			item.detail = `Fastlane Action (${actionDef.platforms.join(", ")})`;
			item.documentation = actionDef.description;
			item.insertText = generateSnippetForAction(actionDef);
			actions.push(item);
		}

		// Add remaining hardcoded actions that aren't in the accurate definitions
		const remainingActions = this.getAdditionalStandardFastlaneActions();
		actions.push(
			...remainingActions.map((action) => {
				const item = new vscode.CompletionItem(action.label, vscode.CompletionItemKind.Function);
				item.detail = action.detail;
				item.documentation = action.documentation;
				item.insertText = action.insertText;
				return item;
			})
		);

		return actions;
	}

	private getAdditionalStandardFastlaneActions(): Array<{
		label: string;
		detail: string;
		documentation: string;
		insertText: vscode.SnippetString;
	}> {
		return [
			// Core fastlane actions
			{
				label: "sh",
				detail: "Shell Command",
				documentation: "쉘 명령어를 실행합니다.",
				insertText: new vscode.SnippetString('sh("${1:command}")'),
			},
			{
				label: "puts",
				detail: "Print Output",
				documentation: "메시지를 출력합니다.",
				insertText: new vscode.SnippetString('puts "${1:message}"'),
			},
			{
				label: "lane",
				detail: "Define Lane",
				documentation: "새로운 레인을 정의합니다.",
				insertText: new vscode.SnippetString(
					"lane :${1:lane_name} do |options|\n  ${2:# lane implementation}\nend"
				),
			},
			{
				label: "private_lane",
				detail: "Define Private Lane",
				documentation: "프라이빗 레인을 정의합니다.",
				insertText: new vscode.SnippetString(
					"private_lane :${1:lane_name} do |options|\n  ${2:# lane implementation}\nend"
				),
			},
			{
				label: "desc",
				detail: "Lane Description",
				documentation: "레인에 대한 설명을 추가합니다.",
				insertText: new vscode.SnippetString('desc "${1:Lane description}"'),
			},
			// iOS Actions (that don't have accurate definitions yet)
			{
				label: "increment_build_number",
				detail: "Increment Build Number",
				documentation: "iOS 빌드 번호를 증가시킵니다.",
				insertText: new vscode.SnippetString(
					"increment_build_number(\n  xcodeproj: \"${1:./ios/PROJECT.xcodeproj}\",\n  build_number: ${2:ENV['NEW_BUILD_NUMBER']}\n)"
				),
			},
			{
				label: "app_store_connect_api_key",
				detail: "App Store Connect API",
				documentation: "App Store Connect API 키를 설정합니다.",
				insertText: new vscode.SnippetString(
					"app_store_connect_api_key(\n  key_id: ${1:ENV['APPLE_API_KEY_ID']},\n  issuer_id: ${2:ENV['APPLE_API_KEY_ISSUER_ID']},\n  key_filepath: ${3:options[:api_key_path]}\n)"
				),
			},
			// Android Actions
			{
				label: "gradle",
				detail: "Gradle Build",
				documentation: "Android Gradle 빌드를 실행합니다.",
				insertText: new vscode.SnippetString(
					'gradle(\n  project_dir: "${1:./android}",\n  tasks: ${2:options[:task]},\n  properties: {\n    "android.injected.signing.store.file" => ${3:options[:keystore_path]},\n    "android.injected.signing.store.password" => ${4:options[:keystore_password]},\n    "android.injected.signing.key.alias" => ${5:options[:keystore_alias]},\n    "android.injected.signing.key.password" => ${6:options[:keystore_key_password]}\n  }\n)'
				),
			},
			{
				label: "upload_to_play_store",
				detail: "Play Store Upload",
				documentation: "Google Play Store에 앱을 업로드합니다.",
				insertText: new vscode.SnippetString(
					'upload_to_play_store(\n  package_name: ${1:options[:app_identifier]},\n  track: "${2|production,beta,alpha,internal|}",\n  json_key: ${3:options[:auth_key_path]},\n  aab: "${4:./android/app/build/outputs/bundle/release/app-release.aab}",\n  release_status: "${5|completed,draft|}",\n  skip_upload_metadata: ${6|true,false|}\n)'
				),
			},
			{
				label: "supply",
				detail: "Upload to Play Store (alias)",
				documentation: "upload_to_play_store의 별칭입니다.",
				insertText: new vscode.SnippetString(
					'supply(\n  package_name: ${1:options[:app_identifier]},\n  track: "${2|production,beta,alpha,internal|}",\n  json_key: ${3:options[:auth_key_path]}\n)'
				),
			},
			// Generic Actions
			{
				label: "git_add",
				detail: "Git Add",
				documentation: "Git에 파일을 추가합니다.",
				insertText: new vscode.SnippetString('git_add(path: "${1:.}")'),
			},
			{
				label: "git_commit",
				detail: "Git Commit",
				documentation: "Git 커밋을 생성합니다.",
				insertText: new vscode.SnippetString(
					'git_commit(\n  path: "${1:.}",\n  message: "${2:commit message}"\n)'
				),
			},
			{
				label: "push_to_git_remote",
				detail: "Git Push",
				documentation: "Git 원격 저장소에 푸시합니다.",
				insertText: new vscode.SnippetString(
					'push_to_git_remote(\n  remote: "${1:origin}",\n  local_branch: "${2:main}",\n  remote_branch: "${3:main}"\n)'
				),
			},
			{
				label: "create_pull_request",
				detail: "Create Pull Request",
				documentation: "풀 리퀘스트를 생성합니다.",
				insertText: new vscode.SnippetString(
					'create_pull_request(\n  api_token: ${1:ENV[\'GITHUB_TOKEN\']},\n  repo: "${2:owner/repo}",\n  title: "${3:PR title}",\n  body: "${4:PR description}"\n)'
				),
			},
			{
				label: "ensure_git_status_clean",
				detail: "Ensure Git Clean",
				documentation: "Git 상태가 깨끗한지 확인합니다.",
				insertText: new vscode.SnippetString("ensure_git_status_clean"),
			},
			{
				label: "notification",
				detail: "Send Notification",
				documentation: "시스템 알림을 보냅니다.",
				insertText: new vscode.SnippetString(
					'notification(\n  title: "${1:Notification Title}",\n  message: "${2:Notification message}"\n)'
				),
			},
			{
				label: "slack",
				detail: "Send Slack Message",
				documentation: "Slack 메시지를 보냅니다.",
				insertText: new vscode.SnippetString(
					'slack(\n  message: "${1:Message}",\n  channel: "${2:#general}",\n  slack_url: ${3:ENV[\'SLACK_URL\']}\n)'
				),
			},
		];
	}

	// Plugin-related methods removed - now using CLI-based dynamic loading

	private isInsideLaneDefinition(
		document: vscode.TextDocument,
		position: vscode.Position
	): boolean {
		let lineIndex = position.line;
		let foundLane = false;
		let foundEnd = false;

		// Look backwards for 'lane' or 'private_lane'
		while (lineIndex >= 0) {
			const line = document.lineAt(lineIndex).text.trim();

			if (line.includes("lane ") && line.includes("do")) {
				foundLane = true;
				break;
			}

			if (line === "end") {
				foundEnd = true;
				break;
			}

			lineIndex--;
		}

		return foundLane && !foundEnd;
	}
}
