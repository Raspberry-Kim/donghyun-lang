const fs = require('fs'), path = require('path');
const { inlineIcons } = require('./icon-files.cjs');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const version = require('./donghyun.js').version.split('.').slice(0, 2).join('.');
fs.writeFileSync(path.join(__dirname, `동현랭-v${version}.html`), inlineIcons(html));
