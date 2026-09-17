import fs from 'fs';

const html = fs.readFileSync('./index.html', 'utf8');

// 1. Check all getElementById in script
const getElemMatches = [...html.matchAll(/getElementById\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g)].map(m => m[1]);
const uniqueQueriedIds = [...new Set(getElemMatches)];

// Extract all id="..." from HTML
const declaredIdMatches = [...html.matchAll(/id\s*=\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
const declaredIds = new Set(declaredIdMatches);

console.log(`Total getElementById calls: ${getElemMatches.length}`);
console.log(`Unique IDs queried: ${uniqueQueriedIds.length}`);
console.log(`Unique IDs declared in HTML: ${declaredIds.size}`);

const missingIds = uniqueQueriedIds.filter(id => !declaredIds.has(id));
console.log('\n--- MISSING ELEMENT IDs ---');
if (missingIds.length === 0) {
  console.log('✔ All getElementById targets exist in HTML!');
} else {
  missingIds.forEach(id => console.log('❌ Missing:', id));
}

// 2. Check all onclick, onchange, oninput in HTML
const eventMatches = [...html.matchAll(/on(click|change|input|submit)\s*=\s*['"]([^'"]+)['"]/g)];
console.log(`\nTotal inline event handlers in HTML: ${eventMatches.length}`);

// Extract function names called
const calledFuncs = new Set();
for (const m of eventMatches) {
  const handlerCode = m[2];
  const fnMatch = handlerCode.match(/^([a-zA-Z0-9_$]+)\s*\(/);
  if (fnMatch) {
    calledFuncs.add(fnMatch[1]);
  }
}

// Extract window.xxx = xxx assignments in script
const windowExposed = new Set([...html.matchAll(/window\.([a-zA-Z0-9_$]+)\s*=/g)].map(m => m[1]));
// Also functions declared with function xxx( in script
const declaredFuncs = new Set([...html.matchAll(/function\s+([a-zA-Z0-9_$]+)\s*\(/g)].map(m => m[1]));

console.log(`\n--- EVENT HANDLERS VERIFICATION ---`);
let missingFuncs = 0;
for (const fn of calledFuncs) {
  const isAvailable = windowExposed.has(fn) || declaredFuncs.has(fn);
  if (!isAvailable) {
    console.log(`❌ Function "${fn}" called in HTML but NOT exposed on window or defined in script!`);
    missingFuncs++;
  }
}
if (missingFuncs === 0) {
  console.log(`✔ All ${calledFuncs.size} distinct functions called in HTML event handlers are defined and exposed!`);
}

// 3. Check tabs referenced in switchTab('...')
const tabMatches = [...html.matchAll(/switchTab\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g)].map(m => m[1]);
const uniqueTabs = [...new Set(tabMatches)];
console.log(`\n--- TABS VERIFICATION ---`);
console.log(`Queried tabs:`, uniqueTabs);
const declaredTabContainers = uniqueTabs.map(t => ({ tab: t, exists: declaredIds.has(`tab-${t}`) }));
declaredTabContainers.forEach(t => {
  if (!t.exists) {
    console.log(`❌ Tab container "tab-${t.tab}" is missing in HTML!`);
  } else {
    console.log(`✔ Tab "tab-${t.tab}" exists.`);
  }
});
