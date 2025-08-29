const { execSync } = require('child_process');

console.log('Starting test build...');

try {
  console.log('Running Next.js build...');
  const result = execSync('next build', { 
    stdio: 'inherit',
    env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096' }
  });
  console.log('Build completed successfully!');
} catch (error) {
  console.error('Build failed with error:', error);
  process.exit(1);
}
