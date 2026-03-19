const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? 
      walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

let matches = [];
walkDir(path.join(__dirname, 'src/components'), function(filePath) {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
    const content = fs.readFileSync(filePath, 'utf-8');
    // find tags that have onClick but are not button, Button, Link, a, Checkbox, SelectTrigger
    const regex = /<(div|span|li|img)[\s\S]*?onClick=[\s\S]*?>/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      if (!match[0].includes('role="button"') && !match[0].includes('role="tab"') && !match[0].includes('role={"button"}')) {
        matches.push({file: filePath, string: match[0]});
      }
    }
  }
});

console.log(JSON.stringify(matches, null, 2));
