const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'src', 'components', 'projects', 'MilestoneSubmissionDialog.tsx');
let content = fs.readFileSync(file, 'utf-8');

const old = `  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const newFiles = selectedFiles.map(file => ({`;

const replacement = `  const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB per file

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    // Validate file sizes
    const oversized = selectedFiles.find(f => f.size > MAX_FILE_SIZE);
    if (oversized) {
      const sizeMB = (oversized.size / (1024 * 1024)).toFixed(1);
      toast.error(\`"\${oversized.name}" (\${sizeMB} MB) exceeds the 100 MB limit per file.\`);
      return;
    }
    const newFiles = selectedFiles.map(file => ({`;

if (content.includes(old)) {
  content = content.replace(old, replacement);
  fs.writeFileSync(file, content);
  console.log('SUCCESS: File updated');
} else {
  console.log('WARN: Target string not found, checking with CRLF...');
  const oldCRLF = old.replace(/\n/g, '\r\n');
  if (content.includes(oldCRLF)) {
    const replacementCRLF = replacement.replace(/\n/g, '\r\n');
    content = content.replace(oldCRLF, replacementCRLF);
    fs.writeFileSync(file, content);
    console.log('SUCCESS: File updated (CRLF)');
  } else {
    console.log('ERROR: Could not find target string');
  }
}
