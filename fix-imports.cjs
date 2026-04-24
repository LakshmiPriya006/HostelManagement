const fs = require('fs');
const path = require('path');
function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.resolve(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { results = results.concat(walk(file)); }
    else if (file.endsWith('.tsx') || file.endsWith('.ts')) { results.push(file); }
  });
  return results;
}
const appFiles = fs.existsSync('app') ? walk('app') : [];
for (const file of appFiles) {
  let relativePathToSrc = path.relative(path.dirname(file), path.resolve('src')).replace(/\\/g, '/');
  if (!relativePathToSrc.endsWith('/')) relativePathToSrc += '/';
  
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;
  
  // Replace relative imports to src components
  const regex = /from\s+['"](\.\.\/)+([^'"]+)['"]/g;
  content = content.replace(regex, (match, prefix, rest) => {
    if (rest.startsWith('components') || rest.startsWith('services') || rest.startsWith('store') || rest.startsWith('utils') || rest.startsWith('types')) {
      changed = true;
      return `from '${relativePathToSrc}${rest}'`;
    }
    return match;
  });
  
  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed imports in', file);
  }
}
