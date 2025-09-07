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
		// Check if we're inside a lane definition or at the top level
		if (this.isInsideLaneDefinition(document, position) || this.isTopLevel(document, position)) {
			return this.allActions;
		}

		return [];
	}

	private isTopLevel(document: vscode.TextDocument, position: vscode.Position): boolean {
		// Simple check for top-level completion (outside of any block)
		const line = document.lineAt(position);
		const lineText = line.text.substring(0, position.character);

		// If line is empty or just whitespace, show completions
		return lineText.trim().length === 0 || lineText.endsWith(" ");
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

		for (const cachedAction of cachedActions) {
			const item = new vscode.CompletionItem(cachedAction.name, vscode.CompletionItemKind.Function);
			item.detail = "Fastlane Action (Cached)";
			item.documentation = cachedAction.description;

			if (cachedAction.parameters && cachedAction.parameters.length > 0) {
				// Create snippet with cached parameters
				const paramSnippets = cachedAction.parameters
					.slice(0, 5) // Limit to first 5 parameters
					.map((param, index) => {
						const placeholder = param.defaultValue
							? `: "${param.defaultValue}"`
							: `: \${${index + 1}:${param.description || "value"}}`;
						return `${param.key}${placeholder}`;
					})
					.join(",\n  ");

				item.insertText = new vscode.SnippetString(`${cachedAction.name}(\n  ${paramSnippets}\n)`);
			} else {
				item.insertText = new vscode.SnippetString(
					`${cachedAction.name}(\n  \${1:# parameters}\n)`
				);
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
				return cached;
			}
		}

		const workspaceRoot = this.getWorkspaceRoot();
		if (!workspaceRoot) return null;

		try {
			const { stdout } = await execAsync(`fastlane action ${actionName}`, {
				cwd: workspaceRoot,
				timeout: 10000,
			});

			const actionInfo = this.parseActionInfo(actionName, stdout);
			if (actionInfo) {
				// Cache the result
				this.actionInfoCache.set(actionName, actionInfo);
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

		for (const line of lines) {
			// Extract description from the main action box
			if (
				line.includes("|") &&
				!line.includes("Key") &&
				!line.includes("---") &&
				!line.includes("+") &&
				!inParametersSection
			) {
				const cleanLine = line
					.replace(/\x1b\[[0-9;]*m/g, "")
					.replace(/\|/g, "")
					.trim();
				if (
					cleanLine &&
					!cleanLine.includes("More information") &&
					!cleanLine.includes("Created by")
				) {
					description = cleanLine;
				}
			}

			// Check if we're entering the parameters section
			if (line.includes("Options") && line.includes(actionName)) {
				inParametersSection = true;
				continue;
			}

			// Parse parameter rows in the options table
			if (
				inParametersSection &&
				line.includes("|") &&
				!line.includes("Key") &&
				!line.includes("---") &&
				!line.includes("+")
			) {
				const parts = line
					.split("|")
					.map((part) => part.replace(/\x1b\[[0-9;]*m/g, "").trim())
					.filter(Boolean);

				if (parts.length >= 2) {
					const key = parts[0];
					const desc = parts[1] || "";
					const envVar = parts.length > 2 ? parts[2] : "";
					const defaultVal = parts.length > 3 ? parts[3] : "";

					if (key && key !== "" && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
						parameters.push({
							key,
							description: desc,
							envVar: envVar || undefined,
							defaultValue: defaultVal || undefined,
							required: !defaultVal && !envVar,
						});
					}
				}
			}
		}

		return {
			name: actionName,
			description: description || `Fastlane action: ${actionName}`,
			parameters,
		};
	}

	private async createParameterizedCompletion(actionName: string): Promise<vscode.CompletionItem> {
		const actionInfo = await this.getActionInfo(actionName);
		const item = new vscode.CompletionItem(actionName, vscode.CompletionItemKind.Function);

		item.detail = "Fastlane Action";
		item.documentation = actionInfo?.description || `Available fastlane action: ${actionName}`;

		if (actionInfo && actionInfo.parameters.length > 0) {
			// Create snippet with parameters
			const paramSnippets = actionInfo.parameters
				.slice(0, 5) // Limit to first 5 parameters to avoid overwhelming
				.map((param, index) => {
					const placeholder = param.defaultValue
						? `: "${param.defaultValue}"`
						: `: \${${index + 1}:${param.description || "value"}}`;
					return `${param.key}${placeholder}`;
				})
				.join(",\n  ");

			item.insertText = new vscode.SnippetString(`${actionName}(\n  ${paramSnippets}\n)`);
		} else {
			item.insertText = new vscode.SnippetString(`${actionName}(\n  \${1:# parameters}\n)`);
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
		const standardActions = this.getStandardFastlaneActions();
		return standardActions.map((action) => {
			const item = new vscode.CompletionItem(action.label, vscode.CompletionItemKind.Function);
			item.detail = action.detail;
			item.documentation = action.documentation;
			item.insertText = action.insertText;
			return item;
		});
	}

	private getStandardFastlaneActions(): Array<{
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
			// iOS Actions
			{
				label: "build_app",
				detail: "Build iOS App",
				documentation: "iOS 앱을 빌드합니다.",
				insertText: new vscode.SnippetString(
					'build_app(\n  export_method: "${1|app-store,development,ad-hoc,enterprise|}",\n  scheme: "${2:SCHEME_NAME}",\n  workspace: "${3:./ios/PROJECT.xcworkspace}",\n  include_bitcode: ${4|true,false|}\n)'
				),
			},
			{
				label: "match",
				detail: "Code Signing",
				documentation: "코드 사이닝 프로필을 관리합니다.",
				insertText: new vscode.SnippetString(
					'match(\n  type: "${1|appstore,development,adhoc|}",\n  readonly: ${2|true,false|},\n  app_identifier: ${3:options[:app_identifier]}\n)'
				),
			},
			{
				label: "upload_to_testflight",
				detail: "TestFlight Upload",
				documentation: "TestFlight에 앱을 업로드합니다.",
				insertText: new vscode.SnippetString(
					'upload_to_testflight(\n  skip_submission: ${1|true,false|},\n  username: "${2:username}",\n  changelog: "${3:changelog}",\n  distribute_external: ${4|true,false|}\n)'
				),
			},
			{
				label: "get_version_number",
				detail: "Get iOS Version",
				documentation: "iOS 프로젝트의 버전 번호를 가져옵니다.",
				insertText: new vscode.SnippetString(
					'get_version_number(\n  xcodeproj: "${1:./ios/PROJECT.xcodeproj}",\n  target: "${2:TARGET_NAME}"\n)'
				),
			},
			{
				label: "increment_build_number",
				detail: "Increment Build Number",
				documentation: "iOS 빌드 번호를 증가시킵니다.",
				insertText: new vscode.SnippetString(
					"increment_build_number(\n  xcodeproj: \"${1:./ios/PROJECT.xcodeproj}\",\n  build_number: ${2:ENV['NEW_BUILD_NUMBER']}\n)"
				),
			},
			{
				label: "latest_testflight_build_number",
				detail: "Latest TestFlight Build",
				documentation: "TestFlight의 최신 빌드 번호를 가져옵니다.",
				insertText: new vscode.SnippetString(
					"latest_testflight_build_number(\n  app_identifier: ${1:options[:app_identifier]},\n  version: ${2:version},\n  initial_build_number: ${3:0}\n)"
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
