const fs = require('fs');

// Read package.json (Source of Truth)
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = packageJson.version;

// Read manifest.json
const manifestPath = 'manifest.json';
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// Update Manifest
console.log(`DaySpark: Syncing manifest version to ${version}...`);
manifest.version = version;

// Write back
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, '\t') + '\n');