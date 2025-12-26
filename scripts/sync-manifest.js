const fs = require('fs');

/**
 * SYNC MANIFEST SCRIPT
 * Keeps manifest.json in sync with package.json metadata.
 * Run automatically during 'npm version'.
 */

try {
    // 1. Read package.json (The source of truth)
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const { version, description, author } = packageJson;

    // 2. Read manifest.json
    const manifestPath = 'manifest.json';
    if (!fs.existsSync(manifestPath)) {
        console.error("DaySpark: manifest.json not found!");
        process.exit(1);
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    // 3. Update fields
    // CLEANUP: Ensure no 'v' prefix exists in the manifest version
    const cleanVersion = version.replace(/^v/, '');
    
    console.log(`DaySpark: Syncing manifest to version ${cleanVersion}...`);
    manifest.version = cleanVersion;
    manifest.description = description;
    manifest.author = author;

    // 4. Write back with consistent formatting (tabs to match Obsidian standard)
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, '\t') + '\n');
    
    console.log("DaySpark: Manifest sync complete.");
} catch (err) {
    console.error("DaySpark: Failed to sync manifest", err);
    process.exit(1);
}