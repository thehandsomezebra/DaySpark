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
			globals: {
				console: "readonly",
				window: "readonly",
				document: "readonly",
				setTimeout: "readonly",
				clearTimeout: "readonly"
			},
		},
		rules: {
			// Obsidian reviewers prefer explicit notices/modals over console spam
			"no-console": "warn",
			// Match Obsidian Bot: Catch unused async and explicit any
			"@typescript-eslint/no-explicit-any": "error",
			"@typescript-eslint/require-await": "error",
			"obsidianmd/ui/sentence-case": [
				"error",
				{
					brands: ["DaySpark", "Open-Meteo", "Google", "Wikipedia", "iCal"],
					acronyms: ["ICS", "URL", "URLs", "AM", "PM"],
					allowAutoFix: true,
				},
			],
		},
	}
);