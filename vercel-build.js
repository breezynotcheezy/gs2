const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('Starting Vercel build script...');

// Ensure we're in the correct directory
const frontendDir = path.join(__dirname, 'front');
if (!fs.existsSync(frontendDir)) {
  console.error('Error: front directory not found');
  process.exit(1);
}

process.chdir(frontendDir);
console.log('Changed to directory:', process.cwd());

// Install dependencies
console.log('Installing dependencies...');
try {
  execSync('pnpm install --no-frozen-lockfile', { stdio: 'inherit' });
  console.log('Dependencies installed successfully');
  
  // Run Next.js build
  console.log('Running Next.js build...');
  execSync('pnpm run build', { stdio: 'inherit' });
  
  // Verify build output
  const nextDir = path.join(frontendDir, '.next');
  if (!fs.existsSync(nextDir)) {
    throw new Error('Next.js build did not create .next directory');
  }
  
  console.log('Build completed successfully!');
  process.exit(0);
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}
