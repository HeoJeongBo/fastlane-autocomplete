#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { exec } = require('node:child_process');
const { promisify } = require('node:util');

const execAsync = promisify(exec);

class FastlaneDataInitializer {
  constructor() {
    this.workspaceRoot = process.cwd();
    this.cacheDir = path.join(this.workspaceRoot, '.vscode', 'fastlane-cache');
    this.cacheFile = path.join(this.cacheDir, 'fastlane-data.json');
  }

  async init() {
    console.log('🚀 Initializing fastlane autocomplete data...');
    
    try {
      // Create cache directory
      this.ensureCacheDirectory();
      
      // Check if fastlane is available
      await this.checkFastlaneAvailable();
      
      // Load all fastlane data
      const fastlaneData = await this.loadAllFastlaneData();
      
      // Save to cache
      this.saveCacheData(fastlaneData);
      
      console.log('✅ Fastlane autocomplete data initialized successfully!');
      console.log(`📁 Cache saved to: ${this.cacheFile}`);
      console.log(`🔢 Loaded ${fastlaneData.actions.length} actions and ${fastlaneData.lanes.length} lanes`);
      
    } catch (error) {
      console.error('❌ Failed to initialize fastlane data:', error.message);
      process.exit(1);
    }
  }

  ensureCacheDirectory() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  async checkFastlaneAvailable() {
    try {
      await execAsync('fastlane --version', { cwd: this.workspaceRoot, timeout: 5000 });
      console.log('✅ Fastlane CLI found');
    } catch (error) {
      throw new Error('Fastlane CLI not found. Please install fastlane first.');
    }
  }

  async loadAllFastlaneData() {
    console.log('📊 Loading actions...');
    const actions = await this.loadActions();
    
    console.log('📋 Loading lanes...');
    const lanes = await this.loadLanes();
    
    console.log('🔍 Loading detailed parameters for common actions...');
    const detailedActions = await this.loadDetailedActions(actions);
    
    return {
      actions: detailedActions,
      lanes: lanes,
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };
  }

  async loadActions() {
    try {
      const { stdout } = await execAsync('fastlane actions', { 
        cwd: this.workspaceRoot,
        timeout: 30000
      });
      
      return this.parseActionsFromCLIOutput(stdout);
    } catch (error) {
      console.warn('⚠️  Failed to load actions:', error.message);
      return [];
    }
  }

  parseActionsFromCLIOutput(output) {
    const actions = [];
    const lines = output.split('\n');
    
    for (const line of lines) {
      if (line.includes('|') && !line.includes('Action') && !line.includes('---') && !line.includes('+')) {
        const parts = line.split('|').map(part => part.trim());
        if (parts.length >= 2 && parts[1]) {
          const actionName = parts[1].replace(/\x1b\[[0-9;]*m/g, '').trim();
          const description = parts.length > 2 ? parts[2].replace(/\x1b\[[0-9;]*m/g, '').trim() : '';
          
          if (actionName && /^[a-zA-Z][a-zA-Z0-9_]*$/.test(actionName) && actionName !== '') {
            actions.push({
              name: actionName,
              description: description || `Available fastlane action: ${actionName}`,
              parameters: [] // Will be filled for common actions
            });
          }
        }
      }
    }
    
    return actions;
  }

  async loadLanes() {
    try {
      const { stdout } = await execAsync('fastlane lanes --json', { 
        cwd: this.workspaceRoot,
        timeout: 15000
      });
      
      return this.parseLanesFromJSON(stdout);
    } catch (error) {
      console.warn('⚠️  Failed to load lanes from CLI, trying file-based parsing...');
      return this.loadLanesFromFile();
    }
  }

  parseLanesFromJSON(jsonOutput) {
    const lanes = [];
    
    try {
      const lanesData = JSON.parse(jsonOutput);
      
      for (const [platform, platformLanes] of Object.entries(lanesData)) {
        if (typeof platformLanes === 'object' && platformLanes) {
          for (const [laneName, laneInfo] of Object.entries(platformLanes)) {
            const description = laneInfo?.description || '';
            lanes.push({
              name: laneName,
              platform: platform,
              description: description || `Lane: ${laneName} [Platform: ${platform}]`
            });
          }
        }
      }
    } catch (error) {
      console.warn('⚠️  Failed to parse lanes JSON:', error.message);
    }
    
    return lanes;
  }

  loadLanesFromFile() {
    const fastfilePath = this.findFastfilePath();
    if (!fastfilePath || !fs.existsSync(fastfilePath)) {
      return [];
    }

    const content = fs.readFileSync(fastfilePath, 'utf8');
    return this.parseLanesFromFile(content);
  }

  findFastfilePath() {
    const fastlaneDir = path.join(this.workspaceRoot, 'fastlane');
    if (fs.existsSync(fastlaneDir)) {
      const fastfilePath = path.join(fastlaneDir, 'Fastfile');
      if (fs.existsSync(fastfilePath)) {
        return fastfilePath;
      }
    }
    return null;
  }

  parseLanesFromFile(content) {
    const lanes = [];
    const laneRegex = /(?:^|\n)\s*(?:private_)?lane\s+:(\w+)/g;
    let match;

    while ((match = laneRegex.exec(content)) !== null) {
      const laneName = match[1];
      lanes.push({
        name: laneName,
        platform: 'unknown',
        description: `Existing Lane: ${laneName}`
      });
    }

    return lanes;
  }

  async loadDetailedActions(actions) {
    const commonActions = [
      'build_app', 'match', 'upload_to_testflight', 'gradle', 
      'upload_to_play_store', 'firebase_app_distribution', 'increment_build_number',
      'get_version_number', 'app_store_connect_api_key', 'git_add', 'git_commit'
    ];

    const detailedActions = [];
    
    for (const action of actions) {
      if (commonActions.includes(action.name)) {
        console.log(`  🔍 Loading parameters for ${action.name}...`);
        const detailedAction = await this.loadActionParameters(action);
        detailedActions.push(detailedAction);
      } else {
        detailedActions.push(action);
      }
    }

    return detailedActions;
  }

  async loadActionParameters(action) {
    try {
      const { stdout } = await execAsync(`fastlane action ${action.name}`, { 
        cwd: this.workspaceRoot,
        timeout: 10000
      });
      
      const parameters = this.parseActionParameters(stdout);
      return {
        ...action,
        parameters: parameters
      };
    } catch (error) {
      console.warn(`⚠️  Failed to load parameters for ${action.name}:`, error.message);
      return action;
    }
  }

  parseActionParameters(output) {
    const lines = output.split('\n');
    const parameters = [];
    let inParametersSection = false;

    for (const line of lines) {
      if (line.includes('Options') || line.includes('Parameters')) {
        inParametersSection = true;
        continue;
      }

      if (inParametersSection && line.includes('|') && !line.includes('Key') && !line.includes('---') && !line.includes('+')) {
        const parts = line.split('|').map(part => part.replace(/\x1b\[[0-9;]*m/g, '').trim()).filter(Boolean);
        
        if (parts.length >= 2) {
          const key = parts[0];
          const description = parts[1] || '';
          const envVar = parts.length > 2 ? parts[2] : '';
          const defaultValue = parts.length > 3 ? parts[3] : '';

          if (key && key !== '' && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
            parameters.push({
              key: key,
              description: description,
              envVar: envVar || undefined,
              defaultValue: defaultValue || undefined,
              required: !defaultValue && !envVar
            });
          }
        }
      }
    }

    return parameters;
  }

  saveCacheData(data) {
    fs.writeFileSync(this.cacheFile, JSON.stringify(data, null, 2), 'utf8');
  }
}

// CLI entry point
if (require.main === module) {
  const initializer = new FastlaneDataInitializer();
  initializer.init().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = FastlaneDataInitializer;