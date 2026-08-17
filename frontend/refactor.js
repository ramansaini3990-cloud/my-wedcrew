const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('./src', function(filePath) {
  if (filePath.endsWith('.jsx') || filePath.endsWith('.js')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // Replace gold with primary for primary elements, keeping gold for accents
    // This is a naive replace, we'll see if it works well enough
    content = content.replace(/btn-gold/g, 'btn-primary');
    content = content.replace(/btn-outline/g, 'btn-primary-outline');
    
    // Change some bg-brand-gold to bg-brand-primary
    content = content.replace(/bg-brand-gold/g, 'bg-brand-primary');
    content = content.replace(/text-brand-gold/g, 'text-brand-primary');
    content = content.replace(/border-brand-gold/g, 'border-brand-primary');
    content = content.replace(/ring-brand-gold/g, 'ring-brand-primary');
    
    // We should also replace text-gray-500 or text-gray-600 with text-brand-textSec
    content = content.replace(/text-gray-500/g, 'text-brand-textSec');
    content = content.replace(/text-gray-600/g, 'text-brand-textSec');
    content = content.replace(/text-gray-900/g, 'text-brand-navy');
    content = content.replace(/text-gray-800/g, 'text-brand-navy');

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Updated', filePath);
    }
  }
});
