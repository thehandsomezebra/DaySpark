import obsidianmd from 'eslint-plugin-obsidianmd';
import tseslint from 'typescript-eslint';

export default tseslint.config(
	// 1. Global Ignores
	{
		ignores: [
			"main.js", 
			"node_modules/**", 
			"scripts/**", 
			"esbuild.config.mjs",
			"*.config.mjs"
		],
	},
	// 2. Base Config
	...obsidianmd.configs.recommended,
	// 3. TypeScript Specific Config (Enables Type-Aware Linting)
	{
		files: ["**/*.ts"],
		languageOptions: {
			parserOptions: {
				project: "./tsconfig.json",
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			// Obsidian reviewers prefer explicit notices/modals over console spam
			"no-console": "warn",
			// This rule sometimes flags Obsidian's internal APIs incorrectly
			"@typescript-eslint/no-explicit-any": "off",
		},
	}
);