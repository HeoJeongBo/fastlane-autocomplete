import * as vscode from "vscode";
import { FastlaneCompletionProvider } from "./completion.provider";
import { FastlaneDataManager } from "./fastlane-data-manager";

export function activate(context: vscode.ExtensionContext) {
	const provider = new FastlaneCompletionProvider();
	const dataManager = new FastlaneDataManager();

	const fastfileCompletionDisposable = vscode.languages.registerCompletionItemProvider(
		{ scheme: "file", language: "fastfile" },
		provider,
		":",
		"(",
		'"',
		"'",
		" "
	);

	const rubyCompletionDisposable = vscode.languages.registerCompletionItemProvider(
		{ scheme: "file", language: "ruby" },
		provider,
		":",
		"(",
		'"',
		"'",
		" "
	);

	// Register commands
	const initDataCommand = vscode.commands.registerCommand(
		"fastlane-autocomplete.initData",
		async () => {
			try {
				vscode.window.showInformationMessage("Initializing Fastlane data...");
				await dataManager.initializeData();
				vscode.window.showInformationMessage(
					"✅ Fastlane data initialized successfully! Restart VSCode to apply changes."
				);
			} catch (error) {
				vscode.window.showErrorMessage(`Failed to initialize Fastlane data: ${error}`);
			}
		}
	);

	const refreshDataCommand = vscode.commands.registerCommand(
		"fastlane-autocomplete.refreshData",
		async () => {
			try {
				vscode.window.showInformationMessage("Refreshing Fastlane data...");
				await dataManager.refreshData();
				vscode.window.showInformationMessage(
					"✅ Fastlane data refreshed successfully! Restart VSCode to apply changes."
				);
			} catch (error) {
				vscode.window.showErrorMessage(`Failed to refresh Fastlane data: ${error}`);
			}
		}
	);

	context.subscriptions.push(
		fastfileCompletionDisposable,
		rubyCompletionDisposable,
		initDataCommand,
		refreshDataCommand
	);
}

export function deactivate() {}
