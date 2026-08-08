import { useEffect, useRef } from 'react';
import { renderEditorCanvas } from '../editor/canvasRenderer';
import { useCanvasInteractions } from '../hooks/useCanvasInteractions';
import { useEditorStore } from '../store/editorStore';

export function EditorCanvas() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const state = useEditorStore();
  const { cursor, handlers } = useCanvasInteractions();
  useEffect(() => {
    if (canvas.current) renderEditorCanvas(canvas.current, state);
  }, [state]);
  return (
    <div className="canvas-viewport">
      <div className="canvas-pan-layer" style={{ transform: `translate(${state.pan.x}px, ${state.pan.y}px) scale(${state.zoom})` }}>
        <canvas ref={canvas} className={`editor-canvas tool-${state.activeTool}`} {...handlers} aria-label="Background Remover editing canvas" />
        {cursor.visible && <span className="brush-cursor" style={{ width: cursor.diameter, height: cursor.diameter, left: cursor.x, top: cursor.y }} />}
      </div>
    </div>
  );
}
