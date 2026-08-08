import type { EditorTool } from '../types/editor';

export const editorTools: { id: EditorTool; label: string; icon: string }[] = [
  { id: 'auto', label: 'Auto', icon: 'auto' },
  { id: 'erase', label: 'Erase', icon: 'erase' },
  { id: 'restore', label: 'Restore', icon: 'restore' },
  { id: 'refine', label: 'Refine Edge', icon: 'refine' },
  { id: 'background', label: 'Background', icon: 'background' },
  { id: 'crop', label: 'Crop', icon: 'crop' },
  { id: 'adjust', label: 'Adjust', icon: 'adjust' },
  { id: 'effects', label: 'Effects', icon: 'effects' },
  { id: 'design', label: 'Design', icon: 'design' },
  { id: 'layers', label: 'Layers', icon: 'layers' }
];
