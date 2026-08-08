import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent } from 'react';
import { useEditorStore } from '../store/editorStore';
import { clientToCanvasPoint, canvasPointToSubjectMask } from '../editor/coordinateTransform';
import { hitTestCrop, moveCrop, type CropHandle } from '../editor/cropEngine';
import { paintMaskStroke } from '../editor/maskBrush';
import type { CropRect, Point, SubjectTransform } from '../types/editor';

interface DragState {
  kind: 'brush' | 'crop' | 'subject' | 'pan' | 'compare';
  last: Point;
  start: Point;
  beforeMask?: Uint8ClampedArray | null;
  crop?: CropRect;
  cropHandle?: CropHandle;
  subject?: SubjectTransform;
  pan?: Point;
}

export function useCanvasInteractions() {
  const state = useEditorStore();
  const drag = useRef<DragState | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);
  const spaceDown = useRef(false);
  const [cursor, setCursor] = useState<{ x: number; y: number; diameter: number; visible: boolean }>({ x: 0, y: 0, diameter: 0, visible: false });

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code === 'Space') spaceDown.current = true;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) state.redo();
        else state.undo();
      }
      if (event.key === '[') state.setBrush({ size: Math.max(4, state.brush.size - 8) });
      if (event.key === ']') state.setBrush({ size: Math.min(420, state.brush.size + 8) });
    };
    const up = (event: KeyboardEvent) => { if (event.code === 'Space') spaceDown.current = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [state]);

  const point = (event: ReactPointerEvent<HTMLCanvasElement>) => clientToCanvasPoint(event.currentTarget, event.clientX, event.clientY);
  const localCursor = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!rect) return;
    const canvasRect = event.currentTarget.getBoundingClientRect();
    const mask = state.workingMask;
    const fit = mask ? Math.min(state.canvasSize.width / mask.width, state.canvasSize.height / mask.height) : 1;
    const cssScale = canvasRect.width / Math.max(1, state.zoom) / state.canvasSize.width;
    setCursor({
      x: (event.clientX - rect.left) / Math.max(0.01, state.zoom),
      y: (event.clientY - rect.top) / Math.max(0.01, state.zoom),
      diameter: state.brush.size * fit * state.subject.scale * cssScale,
      visible: state.activeTool === 'erase' || state.activeTool === 'restore'
    });
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom: state.zoom };
      return;
    }
    const current = point(event);
    if (spaceDown.current || event.button === 1 || (event.pointerType === 'touch' && !['erase', 'restore', 'crop', 'design'].includes(state.activeTool))) {
      drag.current = { kind: 'pan', start: { x: event.clientX, y: event.clientY }, last: current, pan: { ...state.pan } };
      return;
    }
    if (state.compareMode === 'slider') {
      drag.current = { kind: 'compare', start: current, last: current };
      state.setComparePosition(current.x / state.canvasSize.width * 100);
      return;
    }
    if ((state.activeTool === 'erase' || state.activeTool === 'restore') && state.workingMask) {
      const maskPoint = canvasPointToSubjectMask(current, state.canvasSize, state.workingMask, state.subject);
      drag.current = { kind: 'brush', start: maskPoint, last: maskPoint, beforeMask: state.captureMaskBefore() };
      paintMaskStroke(state.workingMask, maskPoint, maskPoint, state.activeTool, state.brush);
      state.touchMask();
      return;
    }
    if (state.activeTool === 'crop' && state.crop) {
      const handle = hitTestCrop(state.crop, current, Math.max(14, state.canvasSize.width / 60));
      if (handle) drag.current = { kind: 'crop', start: current, last: current, crop: { ...state.crop }, cropHandle: handle };
      return;
    }
    if (state.activeTool === 'design') drag.current = { kind: 'subject', start: current, last: current, subject: { ...state.subject } };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    localCursor(event);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      state.setZoom(pinch.current.zoom * distance / Math.max(1, pinch.current.distance));
      return;
    }
    if (!drag.current) return;
    const current = point(event);
    if (drag.current.kind === 'brush' && state.workingMask) {
      const maskPoint = canvasPointToSubjectMask(current, state.canvasSize, state.workingMask, state.subject);
      paintMaskStroke(state.workingMask, drag.current.last, maskPoint, state.activeTool as 'erase' | 'restore', state.brush);
      drag.current.last = maskPoint;
      state.touchMask();
    } else if (drag.current.kind === 'crop' && drag.current.crop && drag.current.cropHandle) {
      state.setCrop(moveCrop(drag.current.crop, drag.current.cropHandle, { x: current.x - drag.current.start.x, y: current.y - drag.current.start.y }, state.canvasSize), false);
    } else if (drag.current.kind === 'subject' && drag.current.subject) {
      state.setSubject({ x: drag.current.subject.x + current.x - drag.current.start.x, y: drag.current.subject.y + current.y - drag.current.start.y }, false);
    } else if (drag.current.kind === 'pan' && drag.current.pan) {
      state.setPan({ x: drag.current.pan.x + event.clientX - drag.current.start.x, y: drag.current.pan.y + event.clientY - drag.current.start.y });
    } else if (drag.current.kind === 'compare') state.setComparePosition(current.x / state.canvasSize.width * 100);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    const currentDrag = drag.current;
    drag.current = null;
    if (!currentDrag) return;
    if (currentDrag.kind === 'brush') state.commitMaskChange(currentDrag.beforeMask || null, state.activeTool === 'erase' ? 'Erase mask stroke' : 'Restore mask stroke');
    if (currentDrag.kind === 'crop' && currentDrag.crop) {
      const final = useEditorStore.getState().crop;
      state.setCrop(currentDrag.crop, false);
      state.setCrop(final, true);
    }
    if (currentDrag.kind === 'subject' && currentDrag.subject) {
      const final = { ...useEditorStore.getState().subject };
      state.setSubject(currentDrag.subject, false);
      state.setSubject(final, true);
    }
  };

  const onWheel = (event: WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    state.setZoom(state.zoom * (event.deltaY > 0 ? 0.9 : 1.1));
  };

  return {
    cursor,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onPointerLeave: () => setCursor((current) => ({ ...current, visible: false })), onWheel }
  };
}
