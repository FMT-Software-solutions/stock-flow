const fs = require('fs');
const path = require('path');

const sourceDir = path.resolve(__dirname, '../../shared-packages/communication/src');
const targetDir = path.resolve(__dirname, '../src/shared-packages/communication');
const migrationsSourceDir = path.resolve(__dirname, '../../shared-packages/communication/supabase_migrations');
const migrationsTargetDir = path.resolve(__dirname, '../supabase/migrations');

function copyDir(src, dest, clearDest = false) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  } else if (clearDest) {
    fs.rmSync(dest, { recursive: true, force: true });
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, false); // Don't clear subdirectories if not asked to at top level, or maybe just rely on top-level clear. For this script, we just copy.
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log(`Syncing communication package src from ${sourceDir} to ${targetDir}...`);
if (fs.existsSync(targetDir)) {
  fs.rmSync(targetDir, { recursive: true, force: true });
}
copyDir(sourceDir, targetDir, false);

console.log(`Syncing communication migrations from ${migrationsSourceDir} to ${migrationsTargetDir}...`);
if (fs.existsSync(migrationsSourceDir)) {
  copyDir(migrationsSourceDir, migrationsTargetDir, false); // Do NOT clear migrationsTargetDir!
}

console.log('Sync complete!');
