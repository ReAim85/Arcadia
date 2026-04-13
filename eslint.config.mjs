import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// We keep FlatCompat ONLY for non-Next configs if needed
const compat = new FlatCompat({
  basePath: __dirname,
  recommendedConfig: js.configs.recommended,
});

const eslintConfig = [
  // 1. Core ESLint Recommended
  js.configs.recommended,

  // 2. Next.js Rules (Native Flat Config support)
  // We use the string path which Next.js 15 handles natively in many cases
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  // 3. Custom Overrides
  {
    rules: {
      "no-unused-vars": "warn",
      "react/react-in-jsx-scope": "off", // Not needed in Next.js
    },
  },
  
  // 4. Ignore build artifacts
  {
    ignores: [".next/*", "out/*", "dist/*"],
  },
];

export default eslintConfig;