import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as postcssScss from 'postcss-scss';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as babelTypes from '@babel/types';

export function activate(context: vscode.ExtensionContext) {
    // Define the decoration type once to reuse it
    const decorationType = vscode.window.createTextEditorDecorationType({
        textDecoration: 'underline wavy #E06C75', // ESLint's red color
        overviewRulerColor: '#E06C75',
        overviewRulerLane: vscode.OverviewRulerLane.Right
    });

    // Function to apply decorations
    async function updateDecorations() {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) return;

            const workspacePath = workspaceFolders[0].uri.fsPath;
            const unusedClasses = await findUnusedClasses(workspacePath);

            const editor = vscode.window.activeTextEditor;
            if (!editor || !editor.document.fileName.endsWith('.scss')) return;

            const text = editor.document.getText();
            const decorationsArray: vscode.DecorationOptions[] = [];

            unusedClasses.forEach((cls) => {
                const regex = new RegExp(`\\.${cls}\\b`, 'g');
                let match;
                while ((match = regex.exec(text)) !== null) {
                    const startPos = editor.document.positionAt(match.index);
                    const endPos = editor.document.positionAt(match.index + match[0].length);
                    const decoration = { range: new vscode.Range(startPos, endPos), hoverMessage: 'Unused class' };
                    decorationsArray.push(decoration);
                }
            });

            editor.setDecorations(decorationType, decorationsArray);
        } catch (error) {
            console.error("Error in updateDecorations:", error);
        }
    }

    // Register the command, even if we plan to use it automatically
    context.subscriptions.push(
        vscode.commands.registerCommand('unusedClassesHighlighter.highlight', updateDecorations)
    );

    // Run the decoration update immediately on activation
    updateDecorations();

    // Listen for relevant events to update decorations automatically
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(updateDecorations),
        vscode.workspace.onDidSaveTextDocument(updateDecorations),
        vscode.window.onDidChangeVisibleTextEditors(updateDecorations)
    );
}

export function deactivate() {}


// Function to find all SCSS files recursively in a directory
function findFilesInDir(startPath: string, filter: RegExp, callback: (filepath: string) => void) {
    if (!fs.existsSync(startPath)) {
        console.log("No directory found:", startPath);
        return;
    }
    const files = fs.readdirSync(startPath);
    for (const file of files) {
        const filename = path.join(startPath, file);
        const stat = fs.lstatSync(filename);
        if (stat.isDirectory()) {
            findFilesInDir(filename, filter, callback); // Recurse into subdirectories
        } else if (filter.test(filename)) {
            callback(filename);
        }
    }
}


// Parse SCSS to get all class names
async function parseSCSS(files: string[]): Promise<Set<string>> {
    const classNames = new Set<string>();
    for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        const root = postcssScss.parse(content);
        root.walkRules(rule => {
            if (rule.selector && rule.selector.startsWith('.')) {
                const selectors = rule.selector.split(/\s+/);
                selectors.forEach(selector => {
                    if (selector.startsWith('.')) {
                        classNames.add(selector.substring(1)); // remove the dot
                    }
                });
            }
        });
    }
    return classNames;
}

// Parse TSX to get all used class names
async function parseTSX(files: string[]): Promise<Set<string>> {
    const classNames = new Set<string>();

    for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');

        // Parse the TSX content into an AST
        const ast = parse(content, {
            sourceType: 'module',
            plugins: ['typescript', 'jsx']
        });

        // Traverse the AST to collect class names
        traverse(ast, {
            JSXAttribute(path) {
                // Check if the attribute is className={...}
                if (path.node.name.name === 'className') {
                    const value = path.node.value;
                    
                    // Handle cases where className is an expression like {styles.someClassName}
                    if (value && value.type === 'JSXExpressionContainer') {
                        const expression = value.expression;

                        if (
                            babelTypes.isMemberExpression(expression) &&
                            babelTypes.isIdentifier(expression.object) &&
                            expression.object.name === 'styles'
                        ) {
                            // Direct usage: className={styles.someClassName}
                            if (babelTypes.isIdentifier(expression.property)) {
                                classNames.add(expression.property.name);
                            }
                        } else if (babelTypes.isConditionalExpression(expression)) {
                            // Ternary expression: className={condition ? styles.class1 : styles.class2}
                            [expression.consequent, expression.alternate].forEach(cond => {
                                if (
                                    babelTypes.isMemberExpression(cond) &&
                                    babelTypes.isIdentifier(cond.object) &&
                                    cond.object.name === 'styles' &&
                                    babelTypes.isIdentifier(cond.property)
                                ) {
                                    classNames.add(cond.property.name);
                                }
                            });
                        } else if (babelTypes.isLogicalExpression(expression)) {
                            // Logical expression: className={condition && styles.className}
                            [expression.left, expression.right].forEach(cond => {
                                if (
                                    babelTypes.isMemberExpression(cond) &&
                                    babelTypes.isIdentifier(cond.object) &&
                                    cond.object.name === 'styles' &&
                                    babelTypes.isIdentifier(cond.property)
                                ) {
                                    classNames.add(cond.property.name);
                                }
                            });
                        }
                    }
                }
            }
        });
    }
    return classNames;
}




// Main function to find unused classes
export async function findUnusedClasses(workspacePath: string): Promise<Set<string>> {
    const scssFiles: string[] = [];
    const tsxFiles: string[] = [];
    console.log("workspacePath", workspacePath);

    // Update the filters to target only *.module.scss and *.tsx files
    findFilesInDir(workspacePath, /\.module\.scss$/, (file) => scssFiles.push(file));
    findFilesInDir(workspacePath, /\.tsx$/, (file) => tsxFiles.push(file));

    // Parse files to get class names from SCSS and TSX
    const scssClasses = await parseSCSS(scssFiles);
    const tsxClasses = await parseTSX(tsxFiles);

    // Determine unused classes
    const unusedClasses = new Set<string>();
    scssClasses.forEach(cls => {
        if (!tsxClasses.has(cls)) {
            unusedClasses.add(cls);
        }
    });

    return unusedClasses;
}
