// Create placeholder PNG icons using Node.js
const fs = require('fs');
const path = require('path');

// Create dist/icons directory
const iconsDir = path.join(__dirname, 'dist', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Smallest valid PNG (1x1 transparent pixel) in base64
const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const pngBuffer = Buffer.from(pngBase64, 'base64');

// Create all three icon sizes
['icon16.png', 'icon48.png', 'icon128.png'].forEach(filename => {
  const filepath = path.join(iconsDir, filename);
  fs.writeFileSync(filepath, pngBuffer);
  console.log(`Created ${filename}`);
});

console.log('Placeholder icons created successfully!');
