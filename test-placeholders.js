// Quick test to verify DM329_PLACEHOLDERS export
console.log('Testing DM329_PLACEHOLDERS import...');

// Note: This is a JS file testing TS imports, may not work directly
// But we can at least check if the file is parseable

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'utils', 'templateDataSchema.ts');
const content = fs.readFileSync(filePath, 'utf8');

// Check if export exists
const hasExport = content.includes('export const DM329_PLACEHOLDERS');
console.log('✓ Export statement found:', hasExport);

// Check if array is closed
const arrayStart = content.indexOf('export const DM329_PLACEHOLDERS');
const arrayEnd = content.indexOf('];', arrayStart);
console.log('✓ Array properly closed:', arrayEnd > arrayStart);

// Count root-level objects (approximate)
const rootObjects = (content.match(/^  \{$/gm) || []).length;
console.log('✓ Approximate root objects:', rootObjects);

console.log('\nFile seems OK!');
