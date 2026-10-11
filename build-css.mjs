#!/usr/bin/env node
/*
 * Concatenate styles/ into htdocs/luci-static/basalt/css/cascade.css.
 *
 * Mirrors footstrap's build-css.sh directory convention:
 *   styles/*.css        -> @layer tokens
 *   styles/base/*.css   -> @layer base
 *   styles/theme/*.css  -> @layer theme
 *   styles/pages/*.css  -> @layer page
 *
 * Each slice (except the banner 00-header.css, which has no wrapper) opens
 * with `@layer <name> {` and closes with `}`; this script unwraps the per-file
 * wrappers and emits one wrapper per layer. The built file is committed, so
 * OpenWrt packaging needs no build step.
 *
 * Usage: node build-css.mjs
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const layers = [
	['tokens', 'styles'],
	['base', 'styles/base'],
	['theme', 'styles/theme'],
	['page', 'styles/pages']
];

let out = '';
for (const [layer, dir] of layers) {
	const full = join(root, dir);
	const files = readdirSync(full).filter(f => f.endsWith('.css')).sort();
	let verbatim = '';
	let body = '';
	for (const f of files) {
		const raw = readFileSync(join(full, f), 'utf8');
		const lines = raw.split(/\r?\n/);
		while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
		const first = lines[0].trim();
		if (!first.startsWith('@layer')) {
			if (body) throw new Error(`${f}: unwrapped slice after wrapped ones in ${dir}`);
			verbatim += raw.trimEnd() + '\n';
			continue;
		}
		if (first !== `@layer ${layer} {`)
			throw new Error(`${f}: opens with "${first}", expected "@layer ${layer} {"`);
		if (lines[lines.length - 1].trim() !== '}')
			throw new Error(`${f}: last line is not the layer wrapper's "}"`);
		body += lines.slice(1, -1).join('\n') + '\n';
	}
	out += verbatim;
	if (body.trim()) out += `@layer ${layer} {\n${body}}\n`;
}

const dest = join(root, 'htdocs/luci-static/basalt/css/cascade.css');
mkdirSync(dirname(dest), { recursive: true });
writeFileSync(dest, out);
const rules = (out.match(/\{/g) || []).length;
console.log(`build-css: ${Buffer.byteLength(out)} bytes, ${rules} rules -> ${dest}`);
if (rules < 100) {
	console.error('build-css: suspiciously few rules — aborting');
	process.exit(1);
}
