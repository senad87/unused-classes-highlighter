// ExampleComponent.tsx

import React from 'react';
import styles from './styles.module.scss';

const ExampleComponent = () => {
    return (
        <div className={styles.container}>
            <div className={styles.rightSide}>Right Side Content</div>
        </div>
    );
};

export default ExampleComponent;
