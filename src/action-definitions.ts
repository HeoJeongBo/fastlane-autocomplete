import * as vscode from "vscode";

export interface ActionDefinition {
	name: string;
	description: string;
	platforms: string[];
	parameters: Array<{
		key: string;
		description: string;
		required?: boolean;
		defaultValue?: string;
		type: 'string' | 'boolean' | 'number' | 'array' | 'object';
		options?: string[];
	}>;
}

/**
 * Accurate action definitions based on fastlane documentation
 */
export const ACCURATE_ACTION_DEFINITIONS: Record<string, ActionDefinition> = {
	get_version_number: {
		name: "get_version_number",
		description: "Get the version number of your project",
		platforms: ["ios", "mac"],
		parameters: [
			{
				key: "xcodeproj",
				description: "Path to the Xcode project to read version number from",
				required: false,
				type: "string"
			},
			{
				key: "target",
				description: "Target name, needed if you have more than one non-test target",
				required: false,
				type: "string"
			},
			{
				key: "configuration",
				description: "Configuration name if you have altered from defaults",
				required: false,
				type: "string"
			}
		]
	},

	get_build_number: {
		name: "get_build_number",
		description: "Get the build number of your project",
		platforms: ["ios", "mac"],
		parameters: [
			{
				key: "xcodeproj",
				description: "Path to your main Xcode project if it is not in the project root directory",
				required: false,
				type: "string"
			},
			{
				key: "hide_error_when_versioning_disabled",
				description: "Used during fastlane init to hide the error message",
				required: false,
				defaultValue: "false",
				type: "boolean"
			}
		]
	},

	latest_testflight_build_number: {
		name: "latest_testflight_build_number",
		description: "Fetches most recent build number from TestFlight",
		platforms: ["ios"],
		parameters: [
			{
				key: "api_key_path",
				description: "Path to App Store Connect API Key JSON file",
				required: false,
				type: "string"
			},
			{
				key: "api_key",
				description: "App Store Connect API Key information",
				required: false,
				type: "object"
			},
			{
				key: "app_identifier",
				description: "Bundle identifier of the app",
				required: true,
				type: "string"
			},
			{
				key: "version",
				description: "Version number to fetch latest build number for",
				required: false,
				type: "string"
			},
			{
				key: "platform",
				description: "Platform (ios, appletvos, osx)",
				required: false,
				defaultValue: "ios",
				type: "string",
				options: ["ios", "appletvos", "osx"]
			},
			{
				key: "username",
				description: "Apple ID Username",
				required: false,
				type: "string"
			},
			{
				key: "team_id",
				description: "App Store Connect team ID",
				required: false,
				type: "string"
			},
			{
				key: "initial_build_number",
				description: "Default build number if no build exists",
				required: false,
				defaultValue: "1",
				type: "number"
			}
		]
	},

	build_app: {
		name: "build_app",
		description: "Build your iOS app",
		platforms: ["ios"],
		parameters: [
			{
				key: "workspace",
				description: "Path to the workspace file",
				required: false,
				type: "string"
			},
			{
				key: "project",
				description: "Path to the project file",
				required: false,
				type: "string"
			},
			{
				key: "scheme",
				description: "The project scheme",
				required: true,
				type: "string"
			},
			{
				key: "clean",
				description: "Should the project be cleaned before building it?",
				required: false,
				defaultValue: "false",
				type: "boolean"
			},
			{
				key: "output_directory",
				description: "The directory in which the ipa file should be stored in",
				required: false,
				type: "string"
			},
			{
				key: "output_name",
				description: "The name of the resulting ipa file",
				required: false,
				type: "string"
			},
			{
				key: "configuration",
				description: "The configuration to use when building the app",
				required: false,
				type: "string"
			},
			{
				key: "silent",
				description: "Hide all information that's not necessary while building",
				required: false,
				defaultValue: "false",
				type: "boolean"
			},
			{
				key: "codesigning_identity",
				description: "The name of the code signing identity to use",
				required: false,
				type: "string"
			},
			{
				key: "skip_package_ipa",
				description: "Should we skip packaging the ipa?",
				required: false,
				defaultValue: "false",
				type: "boolean"
			},
			{
				key: "include_bitcode",
				description: "Should the ipa file include bitcode?",
				required: false,
				type: "boolean"
			},
			{
				key: "include_symbols",
				description: "Should the ipa file include symbols?",
				required: false,
				type: "boolean"
			},
			{
				key: "archive_path",
				description: "The path to the created archive",
				required: false,
				type: "string"
			},
			{
				key: "export_method",
				description: "Method used to export the archive",
				required: false,
				type: "string",
				options: ["app-store", "development", "ad-hoc", "enterprise"]
			},
			{
				key: "export_options",
				description: "Path to an export options plist or a hash with export options",
				required: false,
				type: "object"
			},
			{
				key: "export_xcargs",
				description: "Pass additional arguments to xcodebuild for the export phase",
				required: false,
				type: "string"
			},
			{
				key: "skip_build_archive",
				description: "Export ipa from existing archive",
				required: false,
				defaultValue: "false",
				type: "boolean"
			}
		]
	},

	match: {
		name: "match",
		description: "Easily sync your certificates and profiles across your team using Git",
		platforms: ["ios"],
		parameters: [
			{
				key: "type",
				description: "Define the profile type",
				required: true,
				type: "string",
				options: ["appstore", "adhoc", "development", "enterprise", "developer_id", "mac_installer_distribution"]
			},
			{
				key: "additional_cert_types",
				description: "Create additional cert types needed for macOS installers",
				required: false,
				type: "array"
			},
			{
				key: "readonly",
				description: "Only fetch existing certificates and profiles, don't generate new ones",
				required: false,
				defaultValue: "false",
				type: "boolean"
			},
			{
				key: "generate_apple_certs",
				description: "Create a certificate type for Xcode 11 and later",
				required: false,
				defaultValue: "true",
				type: "boolean"
			},
			{
				key: "skip_confirmation",
				description: "Disables confirmation prompts during nuke",
				required: false,
				defaultValue: "false",
				type: "boolean"
			},
			{
				key: "safe_remove_certs",
				description: "Remove certs from repository during nuke without revoking them on the developer portal",
				required: false,
				defaultValue: "false",
				type: "boolean"
			},
			{
				key: "app_identifier",
				description: "The bundle identifier(s) of your app",
				required: true,
				type: "array"
			},
			{
				key: "api_key_path",
				description: "Path to App Store Connect API Key JSON file",
				required: false,
				type: "string"
			},
			{
				key: "api_key",
				description: "App Store Connect API Key information",
				required: false,
				type: "object"
			},
			{
				key: "username",
				description: "Your Apple ID Username",
				required: false,
				type: "string"
			},
			{
				key: "team_id",
				description: "The ID of your Developer Portal team",
				required: false,
				type: "string"
			},
			{
				key: "team_name",
				description: "The name of your Developer Portal team",
				required: false,
				type: "string"
			},
			{
				key: "storage_mode",
				description: "Define where you want to store your certificates",
				required: false,
				defaultValue: "git",
				type: "string",
				options: ["git", "google_cloud", "s3"]
			},
			{
				key: "git_url",
				description: "URL to the git repo containing all the certificates",
				required: false,
				type: "string"
			},
			{
				key: "git_branch",
				description: "Specific git branch to use",
				required: false,
				defaultValue: "master",
				type: "string"
			},
			{
				key: "git_full_name",
				description: "git user full name to commit",
				required: false,
				type: "string"
			},
			{
				key: "git_user_email",
				description: "git user email to commit",
				required: false,
				type: "string"
			},
			{
				key: "shallow_clone",
				description: "Make a shallow clone of the repository (truncate the history to 1 revision)",
				required: false,
				defaultValue: "false",
				type: "boolean"
			},
			{
				key: "clone_branch_directly",
				description: "Clone just the branch specified, instead of the whole repo",
				required: false,
				defaultValue: "false",
				type: "boolean"
			}
		]
	},

	upload_to_testflight: {
		name: "upload_to_testflight",
		description: "Upload a new binary to Apple TestFlight",
		platforms: ["ios"],
		parameters: [
			{
				key: "api_key_path",
				description: "Path to App Store Connect API Key JSON file",
				required: false,
				type: "string"
			},
			{
				key: "api_key",
				description: "App Store Connect API Key information",
				required: false,
				type: "object"
			},
			{
				key: "username",
				description: "Your Apple ID Username",
				required: false,
				type: "string"
			},
			{
				key: "app_identifier",
				description: "The bundle identifier of the app to upload",
				required: false,
				type: "string"
			},
			{
				key: "app_platform",
				description: "The platform to upload",
				required: false,
				defaultValue: "ios",
				type: "string",
				options: ["ios", "appletvos", "osx"]
			},
			{
				key: "ipa",
				description: "Path to the ipa file to upload",
				required: false,
				type: "string"
			},
			{
				key: "demo_account_required",
				description: "Do you need a demo account when Apple does review?",
				required: false,
				defaultValue: "false",
				type: "boolean"
			},
			{
				key: "beta_app_review_info",
				description: "Beta app review information for contact info and demo account",
				required: false,
				type: "object"
			},
			{
				key: "localized_app_info",
				description: "Localized beta app test info for description, feedback email, marketing URL, and privacy policy",
				required: false,
				type: "object"
			},
			{
				key: "beta_app_description",
				description: "Provide the 'What to Test' text when uploading a new binary",
				required: false,
				type: "string"
			},
			{
				key: "beta_app_feedback_email",
				description: "Provide the beta app email when uploading a new binary",
				required: false,
				type: "string"
			},
			{
				key: "localized_build_info",
				description: "Localized beta app test info for what's new",
				required: false,
				type: "object"
			},
			{
				key: "changelog",
				description: "Provide the 'What to Test' text when uploading a new binary",
				required: false,
				type: "string"
			},
			{
				key: "skip_submission",
				description: "Skip the distributing action of pilot and only upload the ipa file",
				required: false,
				defaultValue: "false",
				type: "boolean"
			},
			{
				key: "skip_waiting_for_build_processing",
				description: "If set to true, the `fastlane pilot` command will not wait for the build to be processed",
				required: false,
				defaultValue: "true",
				type: "boolean"
			},
			{
				key: "update_build_info_on_upload",
				description: "Whether to update build info immediately after validation",
				required: false,
				defaultValue: "false",
				type: "boolean"
			},
			{
				key: "distribute_external",
				description: "Should the build be distributed to external testers?",
				required: false,
				defaultValue: "false",
				type: "boolean"
			},
			{
				key: "notify_external_testers",
				description: "Should notify external testers?",
				required: false,
				type: "boolean"
			},
			{
				key: "app_version",
				description: "The version of the app to use instead of the one from the ipa file",
				required: false,
				type: "string"
			},
			{
				key: "build_number",
				description: "The build number of the app to use instead of the one from the ipa file",
				required: false,
				type: "string"
			},
			{
				key: "expire_previous_builds",
				description: "Should expire previous builds?",
				required: false,
				defaultValue: "false",
				type: "boolean"
			},
			{
				key: "first_name",
				description: "The tester's first name",
				required: false,
				type: "string"
			},
			{
				key: "last_name",
				description: "The tester's last name",
				required: false,
				type: "string"
			},
			{
				key: "email",
				description: "The tester's email",
				required: false,
				type: "string"
			},
			{
				key: "testers_file_path",
				description: "Path to a CSV file of testers",
				required: false,
				type: "string"
			},
			{
				key: "groups",
				description: "Associate tester to one group or more by group name",
				required: false,
				type: "array"
			},
			{
				key: "team_id",
				description: "The ID of your App Store Connect team",
				required: false,
				type: "string"
			},
			{
				key: "team_name",
				description: "The name of your App Store Connect team",
				required: false,
				type: "string"
			},
			{
				key: "dev_portal_team_id",
				description: "The short ID of your team in the developer portal",
				required: false,
				type: "string"
			},
			{
				key: "itc_provider",
				description: "The provider short name to be used with the iTMSTransporter to identify your team",
				required: false,
				type: "string"
			},
			{
				key: "wait_processing_interval",
				description: "Interval in seconds to wait for App Store Connect processing",
				required: false,
				defaultValue: "30",
				type: "number"
			},
			{
				key: "wait_processing_timeout_duration",
				description: "Timeout duration in seconds to wait for App Store Connect processing",
				required: false,
				defaultValue: "1800",
				type: "number"
			},
			{
				key: "wait_for_uploaded_build",
				description: "Use version info from uploaded ipa file to determine what build to use for distribution",
				required: false,
				defaultValue: "false",
				type: "boolean"
			},
			{
				key: "reject_build_waiting_for_review",
				description: "Expire previous if it's 'waiting for review'",
				required: false,
				defaultValue: "false",
				type: "boolean"
			}
		]
	},

	// Plugin Actions
	firebase_app_distribution: {
		name: "firebase_app_distribution",
		description: "Upload your app to Firebase App Distribution",
		platforms: ["ios", "android"],
		parameters: [
			{
				key: "app",
				description: "App ID of the Firebase App (e.g. 1:123456789:ios:abcd1234)",
				required: true,
				type: "string"
			},
			{
				key: "firebase_cli_token",
				description: "Auth token generated using firebase login:ci",
				required: false,
				type: "string"
			},
			{
				key: "service_credentials_file",
				description: "Path to Google service credentials file",
				required: false,
				type: "string"
			},
			{
				key: "ipa_path",
				description: "Path to your IPA file (iOS only)",
				required: false,
				type: "string"
			},
			{
				key: "apk_path",
				description: "Path to your APK file (Android only)",
				required: false,
				type: "string"
			},
			{
				key: "android_artifact_path",
				description: "Path to your Android artifact file",
				required: false,
				type: "string"
			},
			{
				key: "android_artifact_type",
				description: "Android artifact type (APK or AAB)",
				required: false,
				defaultValue: "APK",
				type: "string",
				options: ["APK", "AAB"]
			},
			{
				key: "groups",
				description: "Distribution groups (comma separated)",
				required: false,
				type: "string"
			},
			{
				key: "testers",
				description: "Tester emails (comma separated)",
				required: false,
				type: "string"
			},
			{
				key: "release_notes",
				description: "Release notes for this distribution",
				required: false,
				type: "string"
			},
			{
				key: "release_notes_file",
				description: "Path to release notes file",
				required: false,
				type: "string"
			},
			{
				key: "debug",
				description: "Enable debug mode",
				required: false,
				defaultValue: "false",
				type: "boolean"
			}
		]
	},

	increment_version_code: {
		name: "increment_version_code",
		description: "Increment the version code of your Android project",
		platforms: ["android"],
		parameters: [
			{
				key: "gradle_file_path",
				description: "Path to the gradle file to update",
				required: false,
				type: "string"
			},
			{
				key: "version_code",
				description: "Set a specific version code",
				required: false,
				type: "number"
			},
			{
				key: "ext_constant_name",
				description: "External constant name to update",
				required: false,
				type: "string"
			}
		]
	},

	android_set_version_name: {
		name: "android_set_version_name",
		description: "Set the version name of your Android project",
		platforms: ["android"],
		parameters: [
			{
				key: "version_name",
				description: "Version name to set",
				required: true,
				type: "string"
			},
			{
				key: "gradle_file",
				description: "Path to the gradle file",
				required: false,
				type: "string"
			}
		]
	},

	android_get_version_name: {
		name: "android_get_version_name",
		description: "Get the version name of your Android project",
		platforms: ["android"],
		parameters: [
			{
				key: "gradle_file",
				description: "Path to the gradle file",
				required: false,
				type: "string"
			},
			{
				key: "ext_constant_name",
				description: "External constant name to read from",
				required: false,
				type: "string"
			}
		]
	},

	android_get_version_code: {
		name: "android_get_version_code",
		description: "Get the version code of your Android project",
		platforms: ["android"],
		parameters: [
			{
				key: "gradle_file",
				description: "Path to the gradle file",
				required: false,
				type: "string"
			},
			{
				key: "ext_constant_name",
				description: "External constant name to read from",
				required: false,
				type: "string"
			}
		]
	}
};

/**
 * Generate a VS Code snippet for an action based on its definition
 */
export function generateSnippetForAction(actionDef: ActionDefinition): vscode.SnippetString {
	if (actionDef.parameters.length === 0) {
		return new vscode.SnippetString(`${actionDef.name}()`);
	}

	// Take most important parameters (required first, then up to 5 total)
	const requiredParams = actionDef.parameters.filter(p => p.required);
	const optionalParams = actionDef.parameters.filter(p => !p.required);
	const selectedParams = [...requiredParams, ...optionalParams].slice(0, 6);

	const parameterStrings = selectedParams.map((param, index) => {
		const placeholderIndex = index + 1;
		let placeholder: string;

		if (param.options && param.options.length > 0) {
			// Use choice placeholder for enum-like parameters
			placeholder = `\${${placeholderIndex}|${param.options.join(',')}|}`;
		} else if (param.defaultValue !== undefined) {
			// Use default value with proper type formatting
			placeholder = formatDefaultValue(param.defaultValue, param.type);
		} else {
			// Create descriptive placeholder
			const shortName = getShortParameterName(param.key, param.description);
			placeholder = `\${${placeholderIndex}:${shortName}}`;
		}

		return `${param.key}: ${placeholder}`;
	}).join(',\n  ');

	return new vscode.SnippetString(`${actionDef.name}(\n  ${parameterStrings}\n)`);
}

/**
 * Format default value based on parameter type
 */
function formatDefaultValue(value: string, type: string): string {
	switch (type) {
		case 'boolean':
			return value.toLowerCase() === 'true' ? 'true' : 'false';
		case 'number':
			return value;
		case 'array':
			return value.startsWith('[') ? value : `[${value}]`;
		case 'object':
			return value.startsWith('{') ? value : `{${value}}`;
		default:
			return `"${value}"`;
	}
}

/**
 * Get a short, meaningful parameter name for placeholder
 */
function getShortParameterName(key: string, description?: string): string {
	const commonMappings: Record<string, string> = {
		'app_identifier': 'bundle_id',
		'workspace': 'workspace_path',
		'scheme': 'scheme_name',
		'export_method': 'export_type',
		'api_key_path': 'auth_key_path',
		'username': 'apple_id',
		'team_id': 'team_id',
		'git_url': 'repo_url',
		'output_directory': 'output_dir',
		'configuration': 'config'
	};

	if (commonMappings[key]) {
		return commonMappings[key];
	}

	// Use the key itself if it's reasonably short
	if (key.length <= 12) {
		return key;
	}

	// Use first meaningful word from description
	if (description) {
		const words = description.toLowerCase().split(/\s+/);
		for (const word of words) {
			if (word.length >= 3 && word.length <= 12 &&
				!['the', 'and', 'or', 'for', 'with', 'from', 'when', 'should'].includes(word)) {
				return word;
			}
		}
	}

	// Fallback to shortened key
	return key.substring(0, 10);
}