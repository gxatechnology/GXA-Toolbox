import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const appUrl = new URL('../public_html/assets/app.js', import.meta.url);
const workspaceUrl = new URL('../public_html/assets/tool-workspace.js', import.meta.url);
const contentPagesUrl = new URL('../public_html/assets/content-pages.js', import.meta.url);

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

  if (!Array.isArray(tools) || tools.length === 0) throw new Error('The central tool registry is empty or invalid.');
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

export async function loadContentPageRegistry() {
  const source = await readFile(contentPagesUrl, 'utf8');
  const context = {};
  vm.createContext(context);
  vm.runInContext(source, context);
  const pages = JSON.parse(JSON.stringify(context.GXA_CONTENT_PAGES));
  const expectedIds = ['about', 'careers', 'security', 'privacy-policy', 'terms', 'gdpr'];

  if (!Array.isArray(pages) || pages.length !== expectedIds.length) {
    throw new Error(`Expected exactly ${expectedIds.length} company/legal pages, found ${Array.isArray(pages) ? pages.length : 0}.`);
  }
  if (pages.map(page => page.id).sort().join(',') !== [...expectedIds].sort().join(',')) {
    throw new Error('Company/legal page registry does not contain the required canonical routes.');
  }
  if (new Set(pages.map(page => page.title)).size !== pages.length) throw new Error('Company/legal page titles must be unique.');
  if (new Set(pages.map(page => page.description)).size !== pages.length) throw new Error('Company/legal page descriptions must be unique.');

  for (const page of pages) {
    if (!page.name || !page.title || !page.description || !page.eyebrow || !page.intro || !page.cta?.label) {
      throw new Error(`Incomplete company/legal page: ${page.id}`);
    }
    if (!Array.isArray(page.sections) || page.sections.length < 4) throw new Error(`Content page needs substantive sections: ${page.id}`);
    const sectionIds = page.sections.map(section => section.id);
    if (new Set(sectionIds).size !== sectionIds.length) throw new Error(`Duplicate section ID on ${page.id}.`);
  }
  return pages;
}

export function canonicalToolUrl(toolId) {
  return `${PRODUCTION_ORIGIN}/${toolId}/`;
}

export function canonicalContentUrl(pageId) {
  return `${PRODUCTION_ORIGIN}/${pageId}/`;
}

export function toolTitle(tool) {
  if (tool.id === 'image-ocr') return 'Image OCR - Extract Text from Images | GXA Toolbox';
  return `${tool.name} | GXA Toolbox`;
}

export function toolDescription(tool) {
  if (tool.id === 'image-ocr') return 'Extract text from JPG, JPEG, PNG, and WEBP images using browser-based OCR with GXA Toolbox.';
  return `${tool.desc} Use it with GXA Toolbox.`;
}
