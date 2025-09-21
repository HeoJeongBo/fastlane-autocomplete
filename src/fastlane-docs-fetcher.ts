// Note: WebFetch will be used as a tool, not imported

export interface ActionParameter {
	key: string;
	description: string;
	required?: boolean;
	defaultValue?: string;
	type?: string;
}

export interface ActionInfo {
	name: string;
	description: string;
	parameters: ActionParameter[];
	platforms: string[];
	examples?: string[];
}

export class FastlaneDocsFetcher {
	private static readonly DOCS_BASE_URL = "https://docs.fastlane.tools/actions/";
	private static readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
	private actionCache: Map<string, { data: ActionInfo; timestamp: number }> = new Map();

	/**
	 * Fetch action information from fastlane docs
	 */
	async getActionInfo(actionName: string): Promise<ActionInfo | null> {
		// Check cache first
		const cached = this.actionCache.get(actionName);
		if (cached && Date.now() - cached.timestamp < FastlaneDocsFetcher.CACHE_DURATION) {
			return cached.data;
		}

		try {
			const url = `${FastlaneDocsFetcher.DOCS_BASE_URL}${actionName}/`;
			const actionInfo = await this.fetchActionFromDocs(url, actionName);

			if (actionInfo) {
				// Cache the result
				this.actionCache.set(actionName, {
					data: actionInfo,
					timestamp: Date.now(),
				});
				return actionInfo;
			}
		} catch (error) {
			console.warn(`Failed to fetch action info for ${actionName}:`, error);
		}

		return null;
	}

	/**
	 * Get a list of common fastlane actions with basic info
	 */
	async getCommonActions(): Promise<ActionInfo[]> {
		const commonActionNames = [
			// iOS Actions
			"build_app",
			"gym",
			"match",
			"upload_to_testflight",
			"get_version_number",
			"increment_build_number",
			"latest_testflight_build_number",
			"app_store_connect_api_key",
			"update_code_signing_settings",
			"update_project_team",

			// Android Actions
			"gradle",
			"android_get_version_name",
			"increment_version_code",
			"google_play_track_version_codes",
			"upload_to_play_store",
			"supply",

			// Generic Actions
			"sh",
			"puts",
			"git_add",
			"git_commit",
			"push_to_git_remote",
			"create_pull_request",
			"ensure_git_status_clean",
			"notification",
			"slack",

			// Testing Actions
			"scan",
			"run_tests",
			"swiftlint",

			// Plugin Actions (common ones)
			"firebase_app_distribution",
		];

		const actions: ActionInfo[] = [];

		// Fetch actions in parallel (but limit concurrency to avoid overwhelming the server)
		const batchSize = 5;
		for (let i = 0; i < commonActionNames.length; i += batchSize) {
			const batch = commonActionNames.slice(i, i + batchSize);
			const batchPromises = batch.map((actionName) => this.getActionInfo(actionName));
			const batchResults = await Promise.allSettled(batchPromises);

			for (const result of batchResults) {
				if (result.status === "fulfilled" && result.value) {
					actions.push(result.value);
				}
			}

			// Add a small delay between batches to be respectful to the server
			if (i + batchSize < commonActionNames.length) {
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
		}

		return actions;
	}

	/**
	 * Fetch action information from fastlane documentation page
	 * Note: This method would require WebFetch tool integration
	 */
	private async fetchActionFromDocs(url: string, actionName: string): Promise<ActionInfo | null> {
		// This method would need to be implemented with tool integration
		// For now, return null to indicate fallback to other methods
		console.log(`Would fetch ${actionName} from ${url}`);
		return null;
	}

	/**
	 * Clear cache
	 */
	clearCache(): void {
		this.actionCache.clear();
	}

	/**
	 * Get cache status
	 */
	getCacheStatus(): { size: number; oldestAge?: number } {
		const now = Date.now();
		let oldestAge: number | undefined;

		for (const { timestamp } of this.actionCache.values()) {
			const age = (now - timestamp) / (60 * 60 * 1000); // in hours
			if (oldestAge === undefined || age > oldestAge) {
				oldestAge = age;
			}
		}

		return {
			size: this.actionCache.size,
			oldestAge,
		};
	}
}
