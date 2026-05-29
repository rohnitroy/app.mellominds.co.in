#!/usr/bin/env node

import './config/env.js';
import passport from './config/passport.js';

console.log('\n=== Passport Configuration Test ===\n');

console.log('1. Passport imported successfully');
console.log('2. Checking Passport strategies:');

// Get all strategies
const strategies = passport._strategies;
console.log('   Available strategies:', Object.keys(strategies));

if (strategies.google) {
  console.log('   ✓ Google strategy is registered');
} else {
  console.log('   ✗ Google strategy is NOT registered');
}

console.log('\n=== Test Complete ===\n');
process.exit(0);
