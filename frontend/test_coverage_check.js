import { isIndianRegion } from './src/services/photorealisticCoverage.js';

console.log('--- Testing Photorealistic Coverage Fallback Logic ---');

// Test 1: Indian region detection for candidate pilot cities
const cities = [
  { name: 'Chennai (Velachery)', lat: 12.9784, lng: 80.2184, expected: true },
  { name: 'Bengaluru (Bellandur)', lat: 12.9260, lng: 77.6762, expected: true },
  { name: 'Mumbai (Kurla West)', lat: 19.0688, lng: 72.8797, expected: true },
  { name: 'San Francisco (US)', lat: 37.7749, lng: -122.4194, expected: false },
  { name: 'London (UK)', lat: 51.5074, lng: -0.1278, expected: false }
];

let allPassed = true;
cities.forEach(c => {
  const result = isIndianRegion(c.lat, c.lng);
  const pass = result === c.expected;
  if (!pass) allPassed = false;
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${c.name}: isIndianRegion=${result} (expected ${c.expected})`);
});

if (allPassed) {
  console.log('\nAll boundary detection tests passed successfully.');
} else {
  console.error('\nSome boundary detection tests failed.');
  process.exit(1);
}
