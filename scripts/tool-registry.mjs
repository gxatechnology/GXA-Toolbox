import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const appUrl = new URL('../public_html/assets/app.js', import.meta.url);
const workspaceUrl = new URL('../public_html/assets/tool-workspace.js', import.meta.url);

export const PRODUCTION_ORIGIN = 'https://gxatoolbox.in';

export async function loadToolRegistry() {
  const source = await readFile(appUrl, 'utf8');
  const start = source.indexOf('const toolsList =');
  const end = source.indexOf('// --- Main Application Controller');
  if (start < 0 || end < 0 || end <= start) throw new Error('Unable to locate the central tool registry.');

  const context = {};
  vm.createContext(context);
  vm.runInContext(`${source.slice(start, end)}\nglobalThis.__GXA_TOOLS__ = toolsList;`, context);
  const tools = JSON.parse(JSON.stringify(context.__GXA_TOOLS__));

  if (!Array.isArray(tools) || tools.length !== 91) {
    throw new Error(`Expected exactly 91 registered tools, found ${Array.isArray(tools) ? tools.length : 0}.`);
  }
  const ids = new Set();
  for (const tool of tools) {
    if (!tool || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tool.id || '')) throw new Error(`Invalid tool ID: ${tool?.id}`);
    if (ids.has(tool.id)) throw new Error(`Duplicate tool ID: ${tool.id}`);
    if (!tool.name || !tool.desc || !tool.category || !tool.icon) throw new Error(`Incomplete registry entry: ${tool.id}`);
    ids.add(tool.id);
  }
  return tools;
}

export async function loadBlockedToolIds() {
  const source = await readFile(workspaceUrl, 'utf8');
  const start = source.indexOf('const blockers');
  const end = source.indexOf('const serverTools');
  if (start < 0 || end < 0 || end <= start) throw new Error('Unable to locate the tool blocker registry.');
  return new Set([...source.slice(start, end).matchAll(/^\s*'([^']+)':\s*'[^']+'/gm)].map(match => match[1]));
}

export function canonicalToolUrl(toolId) {
  return `${PRODUCTION_ORIGIN}/${toolId}/`;
}

export function toolTitle(tool) {
  return `${tool.name} | GXA Toolbox`;
}

export function toolDescription(tool) {
  return `${tool.desc} Use it with GXA Toolbox.`;
}
