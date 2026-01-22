const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const outputFile = path.join(rootDir, 'app.tar');

console.log('Creating app.tar...');

// Excludes: node_modules, .git, .env, dist, app.tar itself
// Using tar command since it's available
try {
    // Windows tar (bsdtar) supports --exclude
    const command = `tar -cf "app.tar" --exclude "node_modules" --exclude ".git" --exclude ".env" --exclude "dist" --exclude "app.tar" .`;
    execSync(command, { cwd: rootDir, stdio: 'inherit' });
    console.log('app.tar created successfully at', outputFile);
} catch (error) {
    console.error('Failed to create app.tar:', error);
    process.exit(1);
}
