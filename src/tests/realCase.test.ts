import * as path from 'path';
import * as fs from 'fs';
import { findUnusedClasses } from '../parser'; // Adjust the import path as necessary

// Helper function to create temporary files for testing
function createTempFile(filePath: string, content: string) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, content);
}

// Helper function to delete temporary files after tests
function deleteTempDirectory(directoryPath: string) {
    if (fs.existsSync(directoryPath)) {
        fs.rmdirSync(directoryPath, { recursive: true });
    }
}

describe('findUnusedClasses with compound class names in template literals', () => {
    const tempDir = path.join(__dirname, 'tempWorkspace');

    beforeAll(() => {
        // Create the temporary TSX file with compound class names
        createTempFile(
            path.join(tempDir, 'Component/Component.tsx'),
            `
            import React from 'react';
            import styles from './Component.module.scss';

            const Component = ({ t, marketplaceLink }) => (
                <div>
                    <Col className={styles.leftCol}>
                        <div className={styles.textContent}>
                            <h2>title</h2>
                            <p>desc</p>
                            <Button
                                id="about_us_slider_download"
                               
                                className={\`\${styles.button} \${styles.tabletAndDesktopButton}\`}
                            >
                                
                            </Button>
                        </div>
                    </Col>
                </div>
            );

            export default Component;
            `
        );

        // Create the temporary SCSS file with the class definitions
        createTempFile(
            path.join(tempDir, 'Component/Component.module.scss'),
            `
            .button {
                display: block;
                position: relative;
                font-family: "EuclidCircularA-SemiBold";
                font-size: 16px;
                letter-spacing: 0.8px;
                text-transform: uppercase;
                border-radius: 100px;
                margin: 0 auto;
                text-align: center;
                width: 327px;
                height: 56px;
                line-height: 42px;
                margin-top: 14px;

            
            }

            .tabletAndDesktopButton {
                margin-left: 0;
                display: none;

          
            }
            `
        );
    });

    afterAll(() => {
        // Clean up the temporary directory and files
        deleteTempDirectory(tempDir);
    });

    it('should recognize both button and tabletAndDesktopButton as used classes', async () => {
        const unusedClasses = await findUnusedClasses(tempDir);

        // Both 'button' and 'tabletAndDesktopButton' should be recognized as used and thus not appear in unusedClasses
        expect(unusedClasses.has('button')).toBe(false); // `button` should be recognized as used
        expect(unusedClasses.has('tabletAndDesktopButton')).toBe(false); // `tabletAndDesktopButton` should be recognized as used
    });
});
