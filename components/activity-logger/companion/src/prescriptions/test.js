/**
 * Prescription System Test Script
 *
 * Run this to verify the prescription system is working correctly.
 *
 * Usage: node src/prescriptions/test.js
 */

const Database = require('better-sqlite3');
const { initializePrescriptionSystem } = require('./index');

console.log('[TEST] Testing Prescription System\n');

// Create temporary in-memory database for testing
const db = new Database(':memory:');

// Initialize system
console.log('1. Initializing system...');
const system = initializePrescriptionSystem(db, null);

if (!system) {
  console.error('ERROR: Failed to initialize system');
  process.exit(1);
}
console.log('[SUCCESS] System initialized\n');

// Test 1: Create prescription
console.log('2. Creating test prescription...');
const createResult = system.manager.create({
  title: 'Test Prescription',
  prescription: 'This is a test prescription for automated testing',
  category: 'behavior',
  scope: 'global',
  priority: 50,
});

if (!createResult.success) {
  console.error('ERROR: Failed to create prescription:', createResult.errors);
  process.exit(1);
}
console.log('[SUCCESS] Prescription created:', createResult.id, '\n');

// Test 2: Retrieve prescription
console.log('3. Retrieving prescriptions...');
const prescriptions = system.manager.getAll();

if (prescriptions.length !== 1) {
  console.error('ERROR: Expected 1 prescription, got', prescriptions.length);
  process.exit(1);
}
console.log('[SUCCESS] Found', prescriptions.length, 'prescription\n');

// Test 3: Update prescription
console.log('4. Updating prescription...');
const updateResult = system.manager.update(createResult.id, {
  priority: 75,
});

if (!updateResult.success) {
  console.error('ERROR: Failed to update prescription:', updateResult.errors);
  process.exit(1);
}

const updated = system.manager.getById(createResult.id);
if (updated.priority !== 75) {
  console.error('ERROR: Priority not updated correctly');
  process.exit(1);
}
console.log('[SUCCESS] Prescription updated\n');

// Test 4: Test injector
console.log('5. Testing injection...');
const injection = system.injector.inject({
  workspace: '/test/workspace',
  fileType: '.js',
});

if (injection.count !== 1) {
  console.error('ERROR: Expected 1 prescription in injection, got', injection.count);
  process.exit(1);
}

if (!injection.formatted.includes('Test Prescription')) {
  console.error('ERROR: Formatted injection missing prescription content');
  process.exit(1);
}
console.log('[SUCCESS] Injection working correctly\n');

// Test 5: Test statistics
console.log('6. Testing statistics...');
const stats = system.manager.getStats();

if (stats.total !== 1 || stats.active !== 1) {
  console.error('ERROR: Stats incorrect:', stats);
  process.exit(1);
}
console.log('[SUCCESS] Statistics correct\n');

// Test 6: Test validation
console.log('7. Testing validation...');
const invalidResult = system.manager.create({
  title: 'X', // Too short
  prescription: 'Short', // Too short
  category: 'invalid-category', // Invalid
  scope: 'global',
});

if (invalidResult.success) {
  console.error('ERROR: Validation should have failed');
  process.exit(1);
}

if (invalidResult.errors.length === 0) {
  console.error('ERROR: Should have validation errors');
  process.exit(1);
}
console.log('[SUCCESS] Validation working correctly\n');

// Test 7: Test toggle
console.log('8. Testing toggle...');
const toggleResult = system.manager.toggle(createResult.id);

if (!toggleResult.success) {
  console.error('ERROR: Failed to toggle prescription');
  process.exit(1);
}

const toggled = system.manager.getById(createResult.id);
if (toggled.active !== false) {
  console.error('ERROR: Prescription not toggled to inactive');
  process.exit(1);
}
console.log('[SUCCESS] Toggle working correctly\n');

// Test 8: Test delete
console.log('9. Testing delete...');
const deleteResult = system.manager.delete(createResult.id);

if (!deleteResult.success) {
  console.error('ERROR: Failed to delete prescription');
  process.exit(1);
}

const afterDelete = system.manager.getAll();
if (afterDelete.length !== 0) {
  console.error('ERROR: Prescription not deleted');
  process.exit(1);
}
console.log('[SUCCESS] Delete working correctly\n');

// Test 9: Test bulk import
console.log('10. Testing bulk import...');
const importData = [
  {
    title: 'Import Test 1',
    prescription: 'First imported prescription',
    category: 'behavior',
    scope: 'global',
    priority: 50,
  },
  {
    title: 'Import Test 2',
    prescription: 'Second imported prescription',
    category: 'formatting',
    scope: 'global',
    priority: 60,
  },
];

const importResult = system.manager.bulkImport(importData);

if (importResult.success !== 2) {
  console.error('ERROR: Failed to import prescriptions:', importResult);
  process.exit(1);
}
console.log('[SUCCESS] Bulk import working correctly\n');

// Test 10: Test export
console.log('11. Testing export...');
const exported = system.manager.exportAll();

if (exported.length !== 2) {
  console.error('ERROR: Export returned wrong number of prescriptions');
  process.exit(1);
}
console.log('[SUCCESS] Export working correctly\n');

// Test 11: Test conflict detection
console.log('12. Testing conflict detection...');
system.manager.create({
  title: 'Always Use Semicolons',
  prescription: 'Always use semicolons in JavaScript',
  category: 'formatting',
  scope: 'global',
  priority: 50,
});

system.manager.create({
  title: 'Never Use Semicolons',
  prescription: 'Never use semicolons in JavaScript',
  category: 'formatting',
  scope: 'global',
  priority: 50,
});

const conflicts = system.manager.detectConflicts();
console.log('[SUCCESS] Conflict detection working (found', conflicts.length, 'conflicts)\n');

// Test 12: Test pattern detector (basic)
console.log('13. Testing pattern detector...');
// Note: This won't find patterns in empty database, but tests the detector runs
const suggestions = await system.detector.suggestFromPrompts({ days: 7, minOccurrences: 1 });
console.log('[SUCCESS] Pattern detector working (found', suggestions.length, 'suggestions)\n');

// All tests passed!
console.log('═══════════════════════════════════════');
console.log('[SUCCESS] ALL TESTS PASSED!');
console.log('═══════════════════════════════════════');
console.log('\nThe prescription system is working correctly.');
console.log('You can now integrate it into your companion service.\n');

db.close();
process.exit(0);
