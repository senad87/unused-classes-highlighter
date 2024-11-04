import * as path from 'path';
import * as fs from 'fs';
import { parseTSX } from '../parser';

// Helper function to create temporary TSX files for testing
function createTempTSXFile(content: string): string {
    const filePath = path.join(__dirname, 'tempTestFile.tsx');
    fs.writeFileSync(filePath, content);
    return filePath;
}

// Helper function to delete the temporary TSX file after tests
function deleteTempTSXFile(filePath: string) {
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
}

describe('parseTSX', () => {
    afterAll(() => {
        deleteTempTSXFile(path.join(__dirname, 'tempTestFile.tsx'));
    });

    it('should identify single class usage', async () => {
        const filePath = createTempTSXFile(`
            import React from 'react';
            import styles from './styles.module.scss';
            export default function Component() {
                return <div className={styles.button}></div>;
            }
        `);

        const result = await parseTSX([filePath]);
        expect(result.has('button')).toBe(true);
        deleteTempTSXFile(filePath);
    });

    it('should identify classes in conditional expressions', async () => {
        const filePath = createTempTSXFile(`
            import React from 'react';
            import styles from './styles.module.scss';
            export default function Component() {
                return <div className={condition ? styles.button : styles.otherButton}></div>;
            }
        `);

        const result = await parseTSX([filePath]);
        expect(result.has('button')).toBe(true);
        expect(result.has('otherButton')).toBe(true);
        deleteTempTSXFile(filePath);
    });

    it('should identify classes in logical expressions', async () => {
        const filePath = createTempTSXFile(`
            import React from 'react';
            import styles from './styles.module.scss';
            export default function Component() {
                return <div className={condition && styles.button}></div>;
            }
        `);

        const result = await parseTSX([filePath]);
        expect(result.has('button')).toBe(true);
        deleteTempTSXFile(filePath);
    });

    it('should identify classes in template literals with single class', async () => {
        const filePath = createTempTSXFile(`
            import React from 'react';
            import styles from './styles.module.scss';
            export default function Component() {
                return <div className={\`\${styles.button}\`}></div>;
            }
        `);

        const result = await parseTSX([filePath]);
        expect(result.has('button')).toBe(true);
        deleteTempTSXFile(filePath);
    });

    it('should identify multiple classes in template literals', async () => {
        const filePath = createTempTSXFile(`
            import React from 'react';
            import styles from './styles.module.scss';
            export default function Component() {
                return <div className={\`\${styles.button} \${styles.tablet600pxButton}\`}></div>;
            }
        `);

        const result = await parseTSX([filePath]);
        expect(result.has('button')).toBe(true);
        expect(result.has('tablet600pxButton')).toBe(true);
        deleteTempTSXFile(filePath);
    });

    it('should identify classes in mixed template literals and expressions', async () => {
        const filePath = createTempTSXFile(`
            import React from 'react';
            import styles from './styles.module.scss';
            export default function Component() {
                return <div className={\`\${condition ? styles.button : styles.otherButton} \${styles.additionalClass}\`}></div>;
            }
        `);

        const result = await parseTSX([filePath]);
        expect(result.has('button')).toBe(true);
        expect(result.has('otherButton')).toBe(true);
        expect(result.has('additionalClass')).toBe(true);
        deleteTempTSXFile(filePath);
    });
});
