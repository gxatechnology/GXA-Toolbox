import { cp, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';

// Only browser builds and licenses are shipped. No Node runtime or CDN is used.
export async function copyEngineVendors(destination) {
  const files = [
    ['prettier/standalone.js', 'prettier/standalone.js'],
    ...['babel', 'estree', 'postcss', 'html'].map(name => [`prettier/plugins/${name}.js`, `prettier/${name}.js`]),
    ['prettier/LICENSE', 'prettier/LICENSE'],
    ['sql-formatter/dist/sql-formatter.min.js', 'sql-formatter/sql-formatter.min.js'],
    ['sql-formatter/LICENSE', 'sql-formatter/LICENSE'],
    ['imagetracerjs/imagetracer_v1.2.6.js', 'imagetracer/imagetracer.js'],
    ['imagetracerjs/LICENSE', 'imagetracer/LICENSE']
  ];
  for (const [source, target] of files) {
    const output = resolve(destination, target);
    await mkdir(dirname(output), { recursive: true });
    await cp(resolve('node_modules', source), output);
  }
}
