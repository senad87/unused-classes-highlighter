import * as vscode from 'vscode';
import { findUnusedClasses } from './parser';

export function activate(context: vscode.ExtensionContext) {
    // Initialize a diagnostics collection to show issues in the Problems tab
    const diagnosticsCollection = vscode.languages.createDiagnosticCollection("unusedClasses");

    async function updateDecorations() {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) return;
    
            for (const folder of workspaceFolders) {
                const workspacePath = folder.uri.fsPath;
                const unusedClassesMap = await findUnusedClasses(workspacePath);
    
                const editor = vscode.window.activeTextEditor;
                if (!editor || !editor.document.fileName.endsWith('.scss')) return;
    
                const filePath = editor.document.uri.fsPath;
                const unusedClasses = unusedClassesMap.get(filePath) || new Set();
    
                const text = editor.document.getText();
                const diagnostics: vscode.Diagnostic[] = [];
    
                unusedClasses.forEach((cls) => {
                    const regex = new RegExp(`\\.${cls}\\b`, 'g');
                    let match;
    
                    while ((match = regex.exec(text)) !== null) {
                        const startPos = editor.document.positionAt(match.index);
                        const endPos = editor.document.positionAt(match.index + match[0].length);
                        const range = new vscode.Range(startPos, endPos);
    
                        // Create a diagnostic for the Problems tab
                        const diagnostic = new vscode.Diagnostic(
                            range,
                            `Unused class '${cls}'`,
                            vscode.DiagnosticSeverity.Warning
                        );
                        diagnostic.source = "Unused Classes Highlighter";
                        diagnostics.push(diagnostic);
                    }
                });
    
                // Update diagnostics for the Problems tab
                diagnosticsCollection.set(editor.document.uri, diagnostics);
            }
        } catch (error) {
            console.error("Error in updateDecorations:", error);
        }
    }
    
    // Register the command to manually run the highlight
    context.subscriptions.push(
        vscode.commands.registerCommand('unusedClassesHighlighter.highlight', updateDecorations)
    );

    // Run the decoration update immediately on activation
    updateDecorations();

    // Listen for relevant events to update diagnostics automatically
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(updateDecorations),
        vscode.workspace.onDidSaveTextDocument(updateDecorations)
    );

    // Set up file watchers to automatically trigger updateDecorations on file changes
    const scssWatcher = vscode.workspace.createFileSystemWatcher('**/*.scss');
    const tsxWatcher = vscode.workspace.createFileSystemWatcher('**/*.tsx');
    
    scssWatcher.onDidChange(updateDecorations);
    tsxWatcher.onDidChange(updateDecorations);
    scssWatcher.onDidCreate(updateDecorations);
    tsxWatcher.onDidCreate(updateDecorations);
    scssWatcher.onDidDelete(updateDecorations);
    tsxWatcher.onDidDelete(updateDecorations);

    context.subscriptions.push(scssWatcher, tsxWatcher, diagnosticsCollection);
}

export function deactivate() {}
