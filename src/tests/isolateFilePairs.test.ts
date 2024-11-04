import * as fs from 'fs';
import * as path from 'path';
import { findUnusedClasses } from '../parser'; // Adjust the import path as necessary

function createTempFile(filePath: string, content: string): void {
    fs.writeFileSync(filePath, content);
}

function deleteTempFile(filePath: string): void {
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
}

describe('findUnusedClasses - Isolated SCSS/TSX Pairs', () => {
    const workspaceDir = path.join(__dirname, 'tempWorkspace');
    const componentDir1 = path.join(workspaceDir, 'Component1');
    const componentDir2 = path.join(workspaceDir, 'Component2');
    const scssFilePath1 = path.join(componentDir1, 'Component1.module.scss');
    const tsxFilePath1 = path.join(componentDir1, 'Component1.tsx');
    const scssFilePath2 = path.join(componentDir2, 'Component2.module.scss');
    const tsxFilePath2 = path.join(componentDir2, 'Component2.tsx');

    beforeAll(() => {
        fs.mkdirSync(componentDir1, { recursive: true });
        fs.mkdirSync(componentDir2, { recursive: true });

        // Create Component1 files
        createTempFile(scssFilePath1, `
            .usedClass1 { color: red; }
            .unusedClass1 { color: blue; }
        `);
        createTempFile(tsxFilePath1, `
            import styles from './Component1.module.scss';
            export default function Component1() {
                return <div className={styles.usedClass1}></div>;
            }
        `);

        // Create Component2 files
        createTempFile(scssFilePath2, `
            .usedClass2 { color: green; }
            .unusedClass2 { color: yellow; }
        `);
        createTempFile(tsxFilePath2, `
            import styles from './Component2.module.scss';
            export default function Component2() {
                return <div className={styles.usedClass2}></div>;
            }
        `);
    });

    afterAll(() => {
        // Clean up files
        deleteTempFile(scssFilePath1);
        deleteTempFile(tsxFilePath1);
        deleteTempFile(scssFilePath2);
        deleteTempFile(tsxFilePath2);
    
        // Clean up directories only if they exist
        if (fs.existsSync(componentDir1)) {
            fs.rmdirSync(componentDir1, { recursive: true });
        }
        if (fs.existsSync(componentDir2)) {
            fs.rmdirSync(componentDir2, { recursive: true });
        }
    
        // Clean up the root tempWorkspace directory if empty
        if (fs.existsSync(workspaceDir)) {
            fs.rmdirSync(workspaceDir, { recursive: true });
        }
    });
    

    it('should detect only unused classes for each SCSS/TSX pair independently', async () => {
        const unusedClassesMap = await findUnusedClasses(workspaceDir);

        // Verify results for Component1
        expect(unusedClassesMap.has(scssFilePath1)).toBe(true);
        expect(unusedClassesMap.get(scssFilePath1)).toEqual(new Set(['unusedClass1']));

        // Verify results for Component2
        expect(unusedClassesMap.has(scssFilePath2)).toBe(true);
        expect(unusedClassesMap.get(scssFilePath2)).toEqual(new Set(['unusedClass2']));
    });
});
