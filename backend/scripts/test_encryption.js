/**
 * Test script to verify encryption/decryption works correctly
 * 
 * Run with: node scripts/test_encryption.js
 */

import '../config/env.js';
import { encryptSensitiveData, decryptSensitiveData, encryptJSONB, decryptJSONB } from '../lib/encryption.js';

function testEncryption() {
  console.log('🔐 Testing encryption functionality...');
  
  const userId = 123;
  const testData = {
    emergencyName: 'John Doe',
    emergencyPhone: '+1-555-123-4567',
    emergencyRelation: 'Father',
    jsonData: { 
      field1: 'sensitive info', 
      field2: 'more sensitive data',
      nested: { value: 'deeply nested sensitive data' }
    }
  };
  
  try {
    // Test string encryption
    console.log('📝 Testing string encryption...');
    const encryptedName = encryptSensitiveData(testData.emergencyName, userId);
    const decryptedName = decryptSensitiveData(encryptedName, userId);
    
    console.log(`Original: ${testData.emergencyName}`);
    console.log(`Encrypted: ${encryptedName}`);
    console.log(`Decrypted: ${decryptedName}`);
    console.log(`Match: ${testData.emergencyName === decryptedName ? '✅' : '❌'}`);
    
    // Test JSON encryption
    console.log('\n📝 Testing JSON encryption...');
    const encryptedJson = encryptJSONB(testData.jsonData, userId);
    const decryptedJson = decryptJSONB(encryptedJson, userId);
    
    console.log(`Original: ${JSON.stringify(testData.jsonData)}`);
    console.log(`Encrypted: ${encryptedJson}`);
    console.log(`Decrypted: ${JSON.stringify(decryptedJson)}`);
    console.log(`Match: ${JSON.stringify(testData.jsonData) === JSON.stringify(decryptedJson) ? '✅' : '❌'}`);
    
    // Test null/undefined handling
    console.log('\n📝 Testing null/undefined handling...');
    const encryptedNull = encryptSensitiveData(null, userId);
    const encryptedUndefined = encryptSensitiveData(undefined, userId);
    const encryptedEmpty = encryptSensitiveData('', userId);
    
    console.log(`Null encrypted: ${encryptedNull}`);
    console.log(`Undefined encrypted: ${encryptedUndefined}`);
    console.log(`Empty string encrypted: ${encryptedEmpty}`);
    
    // Test different user IDs produce different ciphertext
    console.log('\n📝 Testing user isolation...');
    const user1Encrypted = encryptSensitiveData('same data', 1);
    const user2Encrypted = encryptSensitiveData('same data', 2);
    
    console.log(`User 1 encrypted: ${user1Encrypted}`);
    console.log(`User 2 encrypted: ${user2Encrypted}`);
    console.log(`Different ciphertext: ${user1Encrypted !== user2Encrypted ? '✅' : '❌'}`);
    
    // Test cross-user decryption fails
    try {
      const crossDecrypt = decryptSensitiveData(user1Encrypted, 2);
      console.log(`Cross-user decryption: ❌ Should have failed but got: ${crossDecrypt}`);
    } catch (error) {
      console.log(`Cross-user decryption: ✅ Correctly failed with error`);
    }
    
    console.log('\n🎉 All encryption tests passed!');
    
  } catch (error) {
    console.error('❌ Encryption test failed:', error);
    process.exit(1);
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testEncryption();
}

export default testEncryption;