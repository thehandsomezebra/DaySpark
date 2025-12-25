.PHONY: bump minor major

# Default: Bump "Patch" version (1.0.0 -> 1.0.1)
# Relies on the "version" script in package.json to sync manifest.json automatically
bump:
	npm version patch
	git push --follow-tags

# Bump "Minor" version (1.0.0 -> 1.1.0)
minor:
	npm version minor
	git push --follow-tags

# Bump "Major" version (1.0.0 -> 2.0.0)
major:
	npm version major
	git push --follow-tags