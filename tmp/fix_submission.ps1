$file = "c:\Users\91731\artswarit1\src\components\projects\MilestoneSubmissionDialog.tsx"
$content = Get-Content $file -Raw

$old = @"
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const newFiles = selectedFiles.map(file => ({
"@

$new = @"
  const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB per file

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    // Validate file sizes
    const oversized = selectedFiles.find(f => f.size > MAX_FILE_SIZE);
    if (oversized) {
      const sizeMB = (oversized.size / (1024 * 1024)).toFixed(1);
      toast.error(``"`${oversized.name}`" (`${sizeMB} MB) exceeds the 100 MB limit per file.``);
      return;
    }
    const newFiles = selectedFiles.map(file => ({
"@

$content = $content.Replace($old, $new)
Set-Content $file -Value $content -NoNewline
Write-Host "Done"
