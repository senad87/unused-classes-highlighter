import * as fs from 'fs';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as babelTypes from '@babel/types';
import * as path from 'path';
import * as postcssScss from 'postcss-scss';


export async function parseTSX(files: string[]): Promise<Set<string>> {
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

                        // Direct MemberExpression (e.g., className={styles.someClassName})
                        if (
                            babelTypes.isMemberExpression(expression) &&
                            babelTypes.isIdentifier(expression.object) &&
                            expression.object.name === 'styles'
                        ) {
                            if (babelTypes.isIdentifier(expression.property)) {
                                classNames.add(expression.property.name);
                            }
                        }

                        // ConditionalExpression (e.g., className={condition ? styles.class1 : styles.class2})
                        else if (babelTypes.isConditionalExpression(expression)) {
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
                        }

                        // LogicalExpression (e.g., className={condition && styles.className})
                        else if (babelTypes.isLogicalExpression(expression)) {
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

                        // TemplateLiteral (e.g., className={`${styles.class1} ${styles.class2}`})
                        else if (babelTypes.isTemplateLiteral(expression)) {
                            expression.expressions.forEach((expr) => {
                                // Handle direct MemberExpression within template literals
                                if (
                                    babelTypes.isMemberExpression(expr) &&
                                    babelTypes.isIdentifier(expr.object) &&
                                    expr.object.name === 'styles' &&
                                    babelTypes.isIdentifier(expr.property)
                                ) {
                                    classNames.add(expr.property.name);
                                }

                                // Handle ConditionalExpression within template literals
                                else if (babelTypes.isConditionalExpression(expr)) {
                                    [expr.consequent, expr.alternate].forEach(cond => {
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
export async function findUnusedClasses(workspacePath: string): Promise<Map<string, Set<string>>> {
    const unusedClassesMap = new Map<string, Set<string>>();

    // Recursively find SCSS files with `.module.scss` suffix
    function findFilesInDir(startPath: string, filter: RegExp): string[] {
        const files: string[] = [];
        if (!fs.existsSync(startPath)) return files;

        const items = fs.readdirSync(startPath);
        for (const item of items) {
            const itemPath = path.join(startPath, item);
            const stat = fs.lstatSync(itemPath);
            if (stat.isDirectory()) {
                files.push(...findFilesInDir(itemPath, filter));
            } else if (filter.test(itemPath)) {
                files.push(itemPath);
            }
        }
        return files;
    }

    // Get all SCSS files and process each one independently
    const scssFiles = findFilesInDir(workspacePath, /\.module\.scss$/);

    for (const scssFile of scssFiles) {
        const dirPath = path.dirname(scssFile);
        const fileNameWithoutExtension = path.basename(scssFile, '.module.scss');

        // Attempt to find corresponding .tsx file
        const tsxFilePath = path.join(dirPath, `${fileNameWithoutExtension}.tsx`);
        if (!fs.existsSync(tsxFilePath)) {
            console.warn(`No corresponding TSX file found for SCSS file: ${scssFile}`);
            continue;
        }

        // Parse SCSS file for class names
        const scssClasses = await parseSCSS([scssFile]);
        // Parse TSX file for used class names
        const usedClassesInFile = await parseTSX([tsxFilePath]);

        // Create a set specifically for this file’s unused classes
        const unusedClasses = new Set<string>();

        // Identify unused classes specifically for this SCSS file
        scssClasses.forEach((cls) => {
            if (!usedClassesInFile.has(cls)) {
                unusedClasses.add(cls);
            }
        });

        // Map unused classes to the file path
        unusedClassesMap.set(scssFile, unusedClasses);
    }

    return unusedClassesMap;
}



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