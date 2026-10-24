#!/usr/bin/env node
// Static compliance and local-reference checks; no browser or production API needed.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const errors = [];
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === '.git' || entry.name === 'node_modules') return [];
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}
const files = walk(root);
const htmlFiles = files.filter((file) => file.endsWith('.html'));
const ids = new Map();
for (const file of htmlFiles) {
  const source = fs.readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  const relative = path.relative(root, file);
  if (/<style\b/i.test(source)) errors.push(`${relative}: embedded <style> block`);
  if (/\sstyle\s*=/i.test(source)) errors.push(`${relative}: inline style attribute`);
  if (!/<link\b[^>]*rel=["']?stylesheet["']?[^>]*href=["']style\.css["']/i.test(source) &&
      !/<link\b[^>]*href=["']style\.css["'][^>]*rel=["']?stylesheet/i.test(source)) {
    errors.push(`${relative}: missing root style.css stylesheet`);
  }
  ids.set(file, new Set([...source.matchAll(/\bid=["']([^"']+)["']/gi)].map((m) => m[1])));
}
const localFiles = new Set(files.map((file) => path.resolve(file).toLowerCase()));
for (const file of htmlFiles) {
  const source = fs.readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  const relative = path.relative(root, file);
  for (const match of source.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)) {
    const ref = match[1];
    if (/^(?:https?:|mailto:|tel:|data:|javascript:|#)/i.test(ref)) {
      if (ref.startsWith('#') && ref.length > 1 && !ids.get(file).has(decodeURIComponent(ref.slice(1)))) errors.push(`${relative}: missing anchor ${ref}`);
      continue;
    }
    const [withQuery, hash] = ref.split('#');
    const pathname = withQuery.split('?')[0];
    if (!pathname) continue;
    const target = path.resolve(path.dirname(file), decodeURIComponent(pathname));
    if (!localFiles.has(target.toLowerCase())) errors.push(`${relative}: missing local reference ${ref}`);
    else if (hash && target.endsWith('.html') && !ids.get(target)?.has(decodeURIComponent(hash))) errors.push(`${relative}: missing anchor ${ref}`);
  }
}
for (const file of files.filter((f) => f.endsWith('.js'))) {
  const source = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g, '');
  if (/\.style\s*(?:\.|=)|style\s*\.\s*setProperty\s*\(|insertRule\s*\(|createElement\s*\(\s*["']style/i.test(source)) {
    errors.push(`${path.relative(root, file)}: JavaScript must not manipulate or inject CSS`);
  }
  for (const match of source.matchAll(/["']((?:assets|images)\/[^"']+)["']/g)) {
    const target = path.resolve(root, match[1]);
    if (!localFiles.has(target.toLowerCase())) errors.push(`${path.relative(root, file)}: missing local asset ${match[1]}`);
  }
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`Site checks passed (${htmlFiles.length} HTML pages, ${files.length} local files).`);
