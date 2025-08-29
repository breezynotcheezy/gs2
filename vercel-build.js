const { execSync } = require('child_process');
const path = require('path');

console.log('Starting custom build script...');

// Change to frontend directory
process.chdir(path.join(__dirname, 'front'));

console.log('Installing dependencies...');
try {
  // Install dependencies with --no-frozen-lockfile
  execSync('pnpm install --no-frozen-lockfile', { stdio: 'inherit' });
  
  console.log('Running build...');
  // Run the build
  execSync('pnpm run build', { stdio: 'inherit' });
  
  console.log('Build completed successfully!');
  process.exit(0);
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}
