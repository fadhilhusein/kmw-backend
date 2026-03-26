#!/usr/bin/env node

/**
 * Security Issues Fix Script
 * Run this to identify and help fix critical security issues before deployment
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Starting Security Audit...\n');

// 1. Check for vulnerable dependencies
console.log('1️⃣ Checking dependency vulnerabilities...');
try {
  execSync('npm audit', { stdio: 'inherit' });
  console.log('✓ Vulnerability check complete\n');
} catch (error) {
  console.log('⚠️  Found vulnerabilities. Run: npm audit fix\n');
}

// 2. Check for exposed credentials
console.log('2️⃣ Checking for exposed credentials...');
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  const envContent = fs.readFileSync(envFile, 'utf8');
  const issues = [];

  if (envContent.includes('rahasia_negara_api')) {
    issues.push('Found weak JWT fallback secret');
  }
  if (envContent.includes('SB-Mid-server')) {
    issues.push('Found Midtrans test key in production env');
  }
  if (envContent.includes('manajemenfebundip2024')) {
    issues.push('Database password may be exposed');
  }

  if (issues.length > 0) {
    console.log('⚠️  Security issues found in .env:');
    issues.forEach(issue => console.log(`   - ${issue}`));
    console.log('   → Generate new secrets for production!\n');
  } else {
    console.log('✓ No obvious credential issues\n');
  }
} else {
  console.log('ℹ️  .env file not found (this is expected for production)\n');
}

// 3. Check for rate limiting
console.log('3️⃣ Checking rate limiting configuration...');
const authRoutesPath = path.join(__dirname, 'routes', 'authRoutes.js');
const authRoutesContent = fs.readFileSync(authRoutesPath, 'utf8');

if (authRoutesContent.includes('// strictRateLimiter')) {
  console.log('⚠️  Rate limiting is DISABLED in authRoutes.js');
  console.log('   → Remove comments from rate limiters for production\n');
} else {
  console.log('✓ Rate limiting appears to be enabled\n');
}

// 4. Check for weak JWT secrets
console.log('4️⃣ Checking JWT secret configuration...');
const filesToCheck = [
  'middleware/authMiddleware.js',
  'controllers/authController.js'
];

let weakSecretFound = false;
filesToCheck.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('"rahasia_negara_api"')) {
      console.log(`⚠️  Weak JWT fallback found in ${file}`);
      weakSecretFound = true;
    }
  }
});

if (weakSecretFound) {
  console.log('   → Remove weak fallbacks or use throw error\n');
} else {
  console.log('✓ No weak JWT fallbacks found\n');
}

// 5. Check environment configuration
console.log('5️⃣ Checking environment configuration...');
const envExamplePath = path.join(__dirname, '.env.example');
if (!fs.existsSync(envExamplePath)) {
  console.log('⚠️  .env.example file missing');
  console.log('   → Create .env.example for deployment guidance\n');
} else {
  console.log('✓ .env.example file exists\n');
}

// 6. Generate secure secrets
console.log('6️⃣ Generating secure secrets (for reference)...');
console.log('Generated JWT_SECRET (save this securely):');
console.log(require('crypto').randomBytes(32).toString('hex'));
console.log();

// 7. Summary
console.log('📋 ACTION SUMMARY:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Before deploying to production:');
console.log('1. Run: npm audit fix');
console.log('2. Generate new JWT_SECRET');
console.log('3. Update production credentials');
console.log('4. Enable rate limiting in authRoutes.js');
console.log('5. Remove weak JWT fallback secrets');
console.log('6. Test all authentication flows');
console.log('7. Update FRONTEND_URL to production domain');
console.log('8. Set NODE_ENV=production');
console.log();
console.log('✅ Ready to check detailed guide: DEPLOYMENT_GUIDE.md\n');