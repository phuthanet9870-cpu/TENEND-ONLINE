// Builds dist/tenend-offline.html: a single self-contained page (game server + client) for testing without a server.
import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const root = path.resolve('.');
const r = await esbuild.build({
  entryPoints: ['offline/entry.js'], bundle: true, format: 'esm', write: false, minify: true, target: 'es2022', legalComments: 'none',
  plugins: [{
    name: 'paths', setup(b) {
      b.onResolve({ filter: /^\/shared\// }, (a) => ({ path: path.join(root, a.path) }));
      b.onResolve({ filter: /\/db\.js$/ }, (a) => (a.importer.includes(`${path.sep}server${path.sep}`) ? { path: path.join(root, 'offline/db-browser.js') } : undefined));
    },
  }],
});
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
let html = fs.readFileSync('client/index.html', 'utf8');
const style = html.match(/<style>[\s\S]*<\/style>/)[0]
  .replace(':root {', ':root { color-scheme:dark;')
  + `<style>#testbar{position:fixed;right:calc(240px + env(safe-area-inset-right,0px));bottom:calc(10px + env(safe-area-inset-bottom,0px));z-index:200;text-align:right}
#tb-body{background:var(--panel);border:1px solid var(--gold);border-radius:6px;padding:10px;margin-top:6px;width:330px;text-align:left;display:flex;flex-direction:column;gap:2px}
#tb-body[hidden]{display:none}#tb-body button{padding:4px 8px;font-size:12px}</style>`;
const body = html.match(/<body>([\s\S]*)<\/body>/)[1].replace(/<script type="module"[^>]*><\/script>/, '');
const out = `<title>TENEND ONLINE</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Kanit:wght@300;400;600&display=swap" rel="stylesheet">
${style}
${body}
<script type="module">${js}</script>
`;
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/tenend-offline.html', out);
console.log('dist/tenend-offline.html', (out.length / 1024).toFixed(0) + ' KB');
