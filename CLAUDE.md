# CLAUDE.md - Fastlane Autocomplete Extension

## 프로젝트 개요
fastlane-autocomplete는 Fastfile 작성을 위한 VSCode extension입니다. Fastfile과 Pluginfile에 설치된 플러그인 기반으로 자동완성과 syntax highlighting을 제공합니다.

## 프로젝트 구조
```
fastlane-autocomplete/
├── src/
│   ├── extension.ts           # 메인 확장 진입점
│   └── completionProvider.ts  # 자동완성 제공자
├── syntaxes/
│   └── fastfile.tmLanguage.json  # Fastfile 신택스 정의
├── .vscode/
│   └── launch.json            # 확장 디버깅 설정
├── package.json               # 확장 메타데이터 및 설정
├── bunfig.toml               # Bun 설정 파일
├── tsconfig.json             # TypeScript 설정
├── language-configuration.json  # 언어 설정
└── .gitignore
```

## 개발 명령어
- `bun install`: 의존성 설치
- `bun run compile`: TypeScript 컴파일
- `bun run dev`: 파일 변경 감지하여 자동 컴파일
- `bun run fastlane:init`: Fastlane 데이터 캐시 초기화
- F5: VSCode에서 확장 디버깅 실행

## 기능
1. **Syntax Highlighting**: Fastfile에 대한 색상 구문 강조
2. **동적 자동완성**: 
   - 실제 설치된 fastlane 액션 (플러그인 포함)
   - 프로젝트의 실제 레인 (`fastlane lanes` 기반)
   - 파라미터가 포함된 스니펫 (`fastlane action` 기반)
3. **성능 최적화된 캐싱**: 
   - 초기화 명령으로 데이터 사전 로드
   - VSCode 명령어로 캐시 새로고침 지원
4. **스마트 fallback**: CLI 실패 시 하드코딩된 액션으로 대체

## 지원하는 Fastlane 액션
### iOS
- app_store_connect_api_key
- match
- build_app
- upload_to_testflight
- get_version_number
- increment_build_number
- latest_testflight_build_number
- update_code_signing_settings
- update_project_team

### Android
- gradle
- android_get_version_name
- increment_version_code
- google_play_track_version_codes
- upload_to_play_store

### 플러그인 (Pluginfile 기반)
- firebase_app_distribution
- firebase_app_distribution_get_latest_release

## 사용 방법
### 첫 설치 후 설정
1. 프로젝트에 fastlane과 Pluginfile이 설정되어 있는지 확인
2. 다음 중 하나의 방법으로 데이터 초기화:
   - 터미널: `bun run fastlane:init` (또는 `npm run fastlane:init`)
   - VSCode 명령어: `Ctrl+Shift+P` → "Fastlane Autocomplete: Initialize Data"
3. VSCode 재시작

### 테스트 방법
1. F5를 눌러 Extension Development Host 실행
2. 새 Fastfile 생성 또는 기존 Fastfile 열기
3. 자동완성 및 신택스 하이라이팅 확인

### 데이터 갱신
- 새 플러그인 설치 후: `Ctrl+Shift+P` → "Fastlane Autocomplete: Refresh Data"
- 캐시는 24시간 후 자동으로 경고 표시

## 빌드 및 배포
1. `vsce package` 명령으로 .vsix 파일 생성
2. VSCode Marketplace에 게시 또는 로컬 설치

## 기술 스택
- **Package Manager**: Bun (빠른 설치와 빌드를 위해 선택)
- **Language**: TypeScript
- **Framework**: VSCode Extension API
- **Build Tool**: TypeScript Compiler (tsc)

## 참고사항
- 이 확장은 `/fastlane/Pluginfile`을 읽어 설치된 플러그인에 따라 자동완성을 동적으로 조정합니다.
- Fastfile의 Ruby 문법을 기반으로 하되, fastlane 특화 기능에 최적화되어 있습니다.
- Bun을 사용하여 개발 효율성과 성능을 최적화했습니다.