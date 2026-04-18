const fs = require('fs');
let file = fs.readFileSync('src/app/layout.tsx', 'utf8');
file = file.replace('../../../public/VFCFantomen.ttf', '../../public/VFCFantomen.ttf');
fs.writeFileSync('src/app/layout.tsx', file);
