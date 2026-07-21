const fs = require('node:fs');
const path = require('node:path');
const { Resvg } = require('@resvg/resvg-js');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'build', 'icon.svg');
const target = path.join(root, 'build', 'icon.png');
const svg = fs.readFileSync(source, 'utf8');
const image = new Resvg(svg, {
  fitTo: { mode: 'width', value: 512 },
  background: 'rgba(0, 0, 0, 0)',
});
fs.writeFileSync(target, image.render().asPng());
