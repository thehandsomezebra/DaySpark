.PHONY: lint fix bump minor major

# Default target: Running 'make' will now just run the linter
lint:
	npx eslint .

# Helper to run the auto-fixer
fix:
	npx eslint . --fix

# Bump "Patch" version (1.0.0 -> 1.0.1)
# Now requires linting to pass before allowing a version bump
bump: lint
	npm version patch
	git push --follow-tags

# Bump "Minor" version (1.0.0 -> 1.1.0)
minor: lint
	npm version minor
	git push --follow-tags

# Bump "Major" version (1.0.0 -> 2.0.0)
major: lint
	npm version major
	git push --follow-tags