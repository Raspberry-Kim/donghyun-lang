const fs = require('fs'), path = require('path');
const files = {
  'favicon.ico': 'image/x-icon',
  'favicon.png': 'image/png',
  'apple-touch-icon.png': 'image/png'
};

// 공개본은 파일 URL, 내려받는 단일 HTML은 내장 아이콘 사용.
function inlineIcons(html) {
  return html.replace(/<link\b[^>]*\brel="(?:icon|apple-touch-icon)"[^>]*>/g, tag =>
    tag.replace(/href="\.\/([^"?]+)(?:\?[^"]*)?"/, (attr, name) => {
      if (!files[name]) return attr;
      const bytes = fs.readFileSync(path.join(__dirname, name));
      return `href="data:${files[name]};base64,${bytes.toString('base64')}"`;
    })
  );
}

function copyIcons(destination) {
  for (const name of Object.keys(files)) {
    fs.copyFileSync(path.join(__dirname, name), path.join(destination, name));
  }
}
module.exports = { inlineIcons, copyIcons };
