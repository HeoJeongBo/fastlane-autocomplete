import * as vscode from 'vscode';
import { FastlaneCompletionProvider } from './completionProvider';

export function activate(context: vscode.ExtensionContext) {
    const provider = new FastlaneCompletionProvider();
    
    const disposable = vscode.languages.registerCompletionItemProvider(
        { scheme: 'file', language: 'fastfile' },
        provider,
        ':', '(', '"', "'", ' '
    );

    context.subscriptions.push(disposable);
}

export function deactivate() {}