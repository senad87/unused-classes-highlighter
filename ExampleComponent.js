"use strict";
// ExampleComponent.tsx
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importDefault(require("react"));
const styles_module_scss_1 = __importDefault(require("./styles.module.scss"));
const ExampleComponent = () => {
    return (<div className={styles_module_scss_1.default.container}>
            <div className={styles_module_scss_1.default.rightSide}>Right Side Content</div>
        </div>);
};
exports.default = ExampleComponent;
//# sourceMappingURL=ExampleComponent.js.map