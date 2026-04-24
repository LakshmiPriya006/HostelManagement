const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.resolve(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        results.push(file);
      }
    }
  });
  return results;
}

const appFiles = fs.existsSync('app') ? walk('app') : [];
const compFiles = fs.existsSync('src/components') ? walk('src/components') : [];
const allFiles = [...appFiles, ...compFiles];

for (const file of allFiles) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // Add "use client" for app files (except layout.tsx)
  if (file.includes(path.sep + 'app' + path.sep) && !file.endsWith('layout.tsx')) {
    if (!content.includes("'use client'") && !content.includes('"use client"')) {
      content = "'use client';\n" + content;
      changed = true;
    }
  }

  // React Router to Next Navigation
  if (content.includes('react-router-dom')) {
    content = content.replace(/import\s+\{([^}]+)\}\s+from\s+['"]react-router-dom['"];?/g, (match, imports) => {
      let nextNav = [];
      let nextLink = false;
      
      const tokens = imports.split(',').map(s => s.trim());
      for (const token of tokens) {
        if (token === 'useNavigate') {
          nextNav.push('useRouter');
        } else if (token === 'useLocation') {
          nextNav.push('usePathname');
        } else if (token === 'Link' || token === 'NavLink') {
          nextLink = true;
        }
      }
      
      let newImports = [];
      if (nextNav.length > 0) {
        newImports.push(`import { ${nextNav.join(', ')} } from 'next/navigation';`);
      }
      if (nextLink) {
        newImports.push(`import Link from 'next/link';`);
      }
      return newImports.join('\n');
    });
    
    // Replace useNavigate() with useRouter()
    content = content.replace(/const (\w+) = useNavigate\(\);?/g, 'const $1 = useRouter();');
    
    // Links
    content = content.replace(/<Link([^>]+)to=/g, '<Link$1href=');
    content = content.replace(/<NavLink([^>]+)to=/g, '<Link$1href=');
    content = content.replace(/<\/NavLink>/g, '</Link>');

    // Optional: replace navigate(...) with router.push(...)
    // Normally $1 is `navigate` or whatever the const was.
    content = content.replace(/\bnavigate\(/g, 'router.push('); // Might break if the const is not named navigate, but usually it is. And we need to make sure `useRouter()` is assigned to `router` instead of `navigate`. Let's fix that.
    content = content.replace(/const navigate = useRouter\(\);?/g, 'const router = useRouter();');

    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Updated', file);
  }
}
