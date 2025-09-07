import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class FastlaneCompletionProvider implements vscode.CompletionItemProvider {
    private fastlaneActions: vscode.CompletionItem[] = [];
    private pluginActions: vscode.CompletionItem[] = [];

    constructor() {
        this.initializeFastlaneActions();
        this.initializePluginActions();
    }

    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
        const line = document.lineAt(position);
        const lineText = line.text.substring(0, position.character);

        // Check if we're inside a lane definition
        if (this.isInsideLaneDefinition(document, position)) {
            return [...this.fastlaneActions, ...this.pluginActions];
        }

        // Check for lane keyword completion
        if (lineText.trim().length === 0 || lineText.endsWith(' ')) {
            return this.getLaneKeywords();
        }

        return [];
    }

    private initializeFastlaneActions(): void {
        const actions = [
            // iOS Actions
            {
                label: 'app_store_connect_api_key',
                detail: 'iOS App Store Connect API Key',
                documentation: 'App Store Connect API 키를 설정합니다.',
                insertText: new vscode.SnippetString('app_store_connect_api_key(\n  key_id: ${1:ENV[\'APPLE_API_KEY_ID\']},\n  issuer_id: ${2:ENV[\'APPLE_API_KEY_ISSUER_ID\']},\n  key_filepath: ${3:options[:api_key_path]}\n)')
            },
            {
                label: 'match',
                detail: 'iOS Code Signing',
                documentation: '코드 사이닝 프로필을 관리합니다.',
                insertText: new vscode.SnippetString('match(\n  type: "${1|appstore,development,adhoc|}", \n  readonly: ${2|true,false|},\n  app_identifier: ${3:options[:app_identifier]}\n)')
            },
            {
                label: 'build_app',
                detail: 'iOS Build',
                documentation: 'iOS 앱을 빌드합니다.',
                insertText: new vscode.SnippetString('build_app(\n  export_method: "${1|app-store,development,ad-hoc,enterprise|}",\n  scheme: "${2:SCHEME_NAME}",\n  workspace: "${3:./ios/PROJECT.xcworkspace}",\n  include_bitcode: ${4|true,false|}\n)')
            },
            {
                label: 'upload_to_testflight',
                detail: 'iOS TestFlight Upload',
                documentation: 'TestFlight에 앱을 업로드합니다.',
                insertText: new vscode.SnippetString('upload_to_testflight(\n  skip_submission: ${1|true,false|},\n  username: "${2:username}",\n  changelog: "${3:changelog}",\n  distribute_external: ${4|true,false|}\n)')
            },
            {
                label: 'get_version_number',
                detail: 'iOS Version Number',
                documentation: 'iOS 프로젝트의 버전 번호를 가져옵니다.',
                insertText: new vscode.SnippetString('get_version_number(\n  xcodeproj: "${1:./ios/PROJECT.xcodeproj}",\n  target: "${2:TARGET_NAME}"\n)')
            },
            {
                label: 'increment_build_number',
                detail: 'iOS Build Number Increment',
                documentation: 'iOS 빌드 번호를 증가시킵니다.',
                insertText: new vscode.SnippetString('increment_build_number(\n  xcodeproj: "${1:./ios/PROJECT.xcodeproj}",\n  build_number: ${2:ENV[\'NEW_BUILD_NUMBER\']}\n)')
            },
            {
                label: 'latest_testflight_build_number',
                detail: 'iOS TestFlight Latest Build',
                documentation: 'TestFlight의 최신 빌드 번호를 가져옵니다.',
                insertText: new vscode.SnippetString('latest_testflight_build_number(\n  app_identifier: ${1:options[:app_identifier]},\n  version: ${2:version},\n  initial_build_number: ${3:0}\n)')
            },
            {
                label: 'update_code_signing_settings',
                detail: 'iOS Code Signing Settings',
                documentation: 'iOS 코드 사이닝 설정을 업데이트합니다.',
                insertText: new vscode.SnippetString('update_code_signing_settings(\n  use_automatic_signing: ${1|true,false|},\n  path: "${2:./ios/PROJECT.xcodeproj}",\n  team_id: ${3:ENV[\'APPLE_TEAM_ID\']},\n  profile_name: ${4:profile_name},\n  code_sign_identity: "${5:iPhone Distribution}",\n  build_configurations: ${6:["Release"]}\n)')
            },
            {
                label: 'update_project_team',
                detail: 'iOS Project Team',
                documentation: 'iOS 프로젝트 팀을 업데이트합니다.',
                insertText: new vscode.SnippetString('update_project_team(\n  path: "${1:./ios/PROJECT.xcodeproj}",\n  teamid: ${2:ENV[\'APPLE_TEAM_ID\']}\n)')
            },
            // Android Actions
            {
                label: 'gradle',
                detail: 'Android Gradle Build',
                documentation: 'Android Gradle 빌드를 실행합니다.',
                insertText: new vscode.SnippetString('gradle(\n  project_dir: "${1:./android}",\n  tasks: ${2:options[:task]},\n  properties: {\n    "android.injected.signing.store.file" => ${3:options[:keystore_path]},\n    "android.injected.signing.store.password" => ${4:options[:keystore_password]},\n    "android.injected.signing.key.alias" => ${5:options[:keystore_alias]},\n    "android.injected.signing.key.password" => ${6:options[:keystore_key_password]}\n  }\n)')
            },
            {
                label: 'android_get_version_name',
                detail: 'Android Version Name',
                documentation: 'Android 버전 이름을 가져옵니다.',
                insertText: new vscode.SnippetString('android_get_version_name(\n  gradle_file: "${1:./android/app/build.gradle}"\n)')
            },
            {
                label: 'increment_version_code',
                detail: 'Android Version Code Increment',
                documentation: 'Android 버전 코드를 증가시킵니다.',
                insertText: new vscode.SnippetString('increment_version_code(\n  gradle_file_path: "${1:./android/app/build.gradle}",\n  version_code: ${2:new_build_number}\n)')
            },
            {
                label: 'google_play_track_version_codes',
                detail: 'Google Play Track Version',
                documentation: 'Google Play의 트랙 버전 코드를 가져옵니다.',
                insertText: new vscode.SnippetString('google_play_track_version_codes(\n  package_name: ${1:options[:app_identifier]},\n  track: "${2|production,beta,alpha,internal|}",\n  json_key: ${3:options[:auth_key_path]}\n)')
            },
            {
                label: 'upload_to_play_store',
                detail: 'Google Play Store Upload',
                documentation: 'Google Play Store에 앱을 업로드합니다.',
                insertText: new vscode.SnippetString('upload_to_play_store(\n  package_name: ${1:options[:app_identifier]},\n  track: "${2|production,beta,alpha,internal|}",\n  json_key: ${3:options[:auth_key_path]},\n  aab: "${4:./android/app/build/outputs/bundle/release/app-release.aab}",\n  release_status: "${5|completed,draft|}",\n  skip_upload_metadata: ${6|true,false|}\n)')
            }
        ];

        this.fastlaneActions = actions.map(action => {
            const item = new vscode.CompletionItem(action.label, vscode.CompletionItemKind.Function);
            item.detail = action.detail;
            item.documentation = action.documentation;
            item.insertText = action.insertText;
            return item;
        });
    }

    private initializePluginActions(): void {
        // Check if Pluginfile exists and parse plugins
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) return;

        const pluginfilePath = path.join(workspaceFolders[0].uri.fsPath, 'fastlane', 'Pluginfile');
        if (fs.existsSync(pluginfilePath)) {
            const content = fs.readFileSync(pluginfilePath, 'utf8');
            this.parsePluginActions(content);
        }
    }

    private parsePluginActions(content: string): void {
        const pluginActions = [
            // Firebase App Distribution
            {
                label: 'firebase_app_distribution',
                detail: 'Firebase App Distribution',
                documentation: 'Firebase App Distribution에 앱을 배포합니다.',
                insertText: new vscode.SnippetString('firebase_app_distribution(\n  app: ${1:ENV["FIREBASE_APP_ID"]},\n  groups: "${2:QA}",\n  release_notes: "${3:release notes}",\n  firebase_cli_path: "${4:/usr/local/bin/firebase}",\n  apk_path: "${5:./android/app/build/outputs/apk/release/app-release.apk}",\n  service_credentials_file: "${6:./firebase-key.json}"\n)')
            },
            {
                label: 'firebase_app_distribution_get_latest_release',
                detail: 'Firebase Latest Release',
                documentation: 'Firebase App Distribution의 최신 릴리스를 가져옵니다.',
                insertText: new vscode.SnippetString('firebase_app_distribution_get_latest_release(\n  app: ${1:ENV["FIREBASE_APP_ID"]},\n  service_credentials_file: ${2:options[:app_distribution_key_path]}\n)')
            }
        ];

        if (content.includes('fastlane-plugin-increment_version_code')) {
            // Already included in Android actions
        }

        if (content.includes('fastlane-plugin-versioning_android')) {
            // Already included in Android actions
        }

        this.pluginActions = pluginActions.map(action => {
            const item = new vscode.CompletionItem(action.label, vscode.CompletionItemKind.Function);
            item.detail = action.detail;
            item.documentation = action.documentation;
            item.insertText = action.insertText;
            return item;
        });
    }

    private getLaneKeywords(): vscode.CompletionItem[] {
        const keywords = [
            {
                label: 'lane',
                detail: 'Public Lane',
                documentation: '공개 레인을 정의합니다.',
                insertText: new vscode.SnippetString('lane :${1:lane_name} do |options|\n  ${2:# lane implementation}\nend')
            },
            {
                label: 'private_lane',
                detail: 'Private Lane',
                documentation: '프라이빗 레인을 정의합니다.',
                insertText: new vscode.SnippetString('private_lane :${1:lane_name} do |options|\n  ${2:# lane implementation}\nend')
            },
            {
                label: 'desc',
                detail: 'Description',
                documentation: '레인에 대한 설명을 추가합니다.',
                insertText: new vscode.SnippetString('desc "${1:Lane description}"')
            }
        ];

        return keywords.map(keyword => {
            const item = new vscode.CompletionItem(keyword.label, vscode.CompletionItemKind.Keyword);
            item.detail = keyword.detail;
            item.documentation = keyword.documentation;
            item.insertText = keyword.insertText;
            return item;
        });
    }

    private isInsideLaneDefinition(document: vscode.TextDocument, position: vscode.Position): boolean {
        let lineIndex = position.line;
        let foundLane = false;
        let foundEnd = false;

        // Look backwards for 'lane' or 'private_lane'
        while (lineIndex >= 0) {
            const line = document.lineAt(lineIndex).text.trim();
            
            if (line.includes('lane ') && line.includes('do')) {
                foundLane = true;
                break;
            }
            
            if (line === 'end') {
                foundEnd = true;
                break;
            }
            
            lineIndex--;
        }

        return foundLane && !foundEnd;
    }
}