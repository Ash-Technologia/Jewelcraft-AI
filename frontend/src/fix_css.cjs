const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

const root = 'c:/Users/user/Downloads/Syrus2026_RoboMasters-main/Syrus2026_RoboMasters-main/frontend/src';

walkDir(root, function (filePath) {
    if (!filePath.endsWith('.css')) return;
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // Remove existing -webkit-backdrop-filter lines to avoid duplicates
    content = content.replace(/[ \t]*-webkit-backdrop-filter:[^;]+;[\r\n]*/g, '');

    // Replace backdrop-filter with the exact block having both
    // Only match lines containing backdrop-filter property
    content = content.replace(/([ \t]*)(backdrop-filter:[^;]+;)/g, '$1-webkit-$2\n$1$2');

    if (content !== original) {
        fs.writeFileSync(filePath, content);
        console.log('Fixed CSS lints in', filePath);
    }
});
