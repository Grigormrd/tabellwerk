import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import storybook from "eslint-plugin-storybook";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores([
    "**/dist/**",
    "**/storybook-static/**",
    "**/coverage/**",
    "**/.turbo/**",
    "**/playwright-report/**",
    "**/test-results/**",
    "!**/.storybook",
  ]),
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["**/*.tsx"],
    ...jsxA11y.flatConfigs.strict,
  },
  reactHooks.configs.flat["recommended-latest"],
  ...storybook.configs["flat/recommended"],
]);
