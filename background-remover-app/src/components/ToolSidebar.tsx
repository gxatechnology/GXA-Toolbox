import type { EditorTool } from '../types/editor';
import { Icon } from './Icon';
import { editorTools } from './editorTools';

interface ToolSidebarProps {
  active: EditorTool;
  onChange: (tool: EditorTool) => void;
}

export function ToolSidebar({ active, onChange }: ToolSidebarProps) {
  return (
    <aside className="tool-sidebar" aria-label="Background Remover editor tools">
      {editorTools.map((tool) => (
        <button key={tool.id} type="button" className={active === tool.id ? 'active' : ''} onClick={() => onChange(tool.id)} aria-pressed={active === tool.id}>
          <Icon name={tool.icon} /><span>{tool.label}</span>
        </button>
      ))}
    </aside>
  );
}
