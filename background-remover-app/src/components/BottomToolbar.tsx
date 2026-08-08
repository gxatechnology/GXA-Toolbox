import type { EditorTool } from '../types/editor';
import { Icon } from './Icon';
import { editorTools } from './editorTools';

interface BottomToolbarProps {
  active: EditorTool;
  onChange: (tool: EditorTool) => void;
}

export function BottomToolbar({ active, onChange }: BottomToolbarProps) {
  return (
    <nav className="bottom-toolbar" aria-label="Mobile editor tools">
      {editorTools.map((tool) => (
        <button key={tool.id} type="button" className={active === tool.id ? 'active' : ''} onClick={() => onChange(tool.id)}>
          <Icon name={tool.icon} size={19} /><span>{tool.label.replace(' Edge', '')}</span>
        </button>
      ))}
    </nav>
  );
}
