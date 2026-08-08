import { create } from 'zustand';
import {
  DEFAULT_ADJUSTMENTS,
  DEFAULT_BACKGROUND,
  DEFAULT_BRUSH,
  DEFAULT_EFFECT,
  DEFAULT_EXPORT,
  DEFAULT_SUBJECT,
  EFFECT_PRESETS
} from '../app/defaults';
import { HistoryManager } from '../editor/historyManager';
import { applyMaskDelta, captureAlpha, createMaskDelta } from '../editor/maskHistory';
import { cropForRatio } from '../editor/cropEngine';
import type {
  Adjustments,
  AdjustmentTarget,
  BackgroundSettings,
  BrushSettings,
  CanvasSize,
  CompareMode,
  CropRect,
  DesignLayer,
  EditorTool,
  EffectSettings,
  ExecutionProvider,
  ExportSettings,
  ImageLayer,
  ProcessingState,
  SegmentationMetrics,
  ShapeLayer,
  SubjectTransform,
  TextLayer
} from '../types/editor';
import { cloneCanvas, getContext, uid } from '../utils/canvas';

type Phase = 'idle' | 'processing' | 'editing' | 'error';

interface EditorStore {
  phase: Phase;
  activeTool: EditorTool;
  sourceFile: File | null;
  sourceUrl: string;
  originalImage: HTMLImageElement | null;
  originalWidth: number;
  originalHeight: number;
  originalMask: HTMLCanvasElement | null;
  workingMask: HTMLCanvasElement | null;
  canvasSize: CanvasSize;
  brush: BrushSettings;
  crop: CropRect | null;
  background: BackgroundSettings;
  adjustmentTarget: AdjustmentTarget;
  adjustments: Record<AdjustmentTarget, Adjustments>;
  effect: EffectSettings;
  subject: SubjectTransform;
  layers: DesignLayer[];
  selectedLayerId: string | null;
  exportSettings: ExportSettings;
  compareMode: CompareMode;
  comparePosition: number;
  zoom: number;
  pan: { x: number; y: number };
  processing: ProcessingState | null;
  provider: ExecutionProvider | null;
  metrics: SegmentationMetrics | null;
  error: string;
  renderRevision: number;
  autoRequest: number;
  undoCount: number;
  redoCount: number;
  setActiveTool: (tool: EditorTool) => void;
  beginReading: (file: File, url: string) => void;
  beginImage: (file: File, url: string, image: HTMLImageElement) => void;
  setProcessing: (processing: ProcessingState) => void;
  setSegmented: (mask: HTMLCanvasElement, provider: ExecutionProvider, metrics: SegmentationMetrics) => void;
  setError: (message: string) => void;
  resetProject: () => void;
  requestAuto: () => void;
  resetAutoMask: () => void;
  invertMask: () => void;
  replaceWorkingMask: (mask: HTMLCanvasElement, label: string) => void;
  captureMaskBefore: () => Uint8ClampedArray | null;
  commitMaskChange: (before: Uint8ClampedArray | null, label: string) => void;
  touchMask: () => void;
  setBrush: (partial: Partial<BrushSettings>) => void;
  setBackground: (partial: Partial<BackgroundSettings>, remember?: boolean) => void;
  setAdjustmentTarget: (target: AdjustmentTarget) => void;
  setAdjustments: (target: AdjustmentTarget, partial: Partial<Adjustments>, remember?: boolean) => void;
  applyEffect: (name: string) => void;
  setSubject: (partial: Partial<SubjectTransform>, remember?: boolean) => void;
  setCrop: (crop: CropRect | null, remember?: boolean) => void;
  setCropRatio: (ratio?: number) => void;
  setCanvasPreset: (size: CanvasSize) => void;
  addTextLayer: () => void;
  addShapeLayer: (shape: ShapeLayer['shape']) => void;
  addImageLayer: (image: HTMLImageElement, imageUrl: string) => void;
  updateLayer: (id: string, partial: Partial<DesignLayer>, remember?: boolean) => void;
  selectLayer: (id: string | null) => void;
  layerAction: (id: string, action: 'toggle' | 'lock' | 'duplicate' | 'delete' | 'forward' | 'backward') => void;
  setExportSettings: (partial: Partial<ExportSettings>) => void;
  setCompareMode: (mode: CompareMode) => void;
  setComparePosition: (position: number) => void;
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  undo: () => void;
  redo: () => void;
}

const history = new HistoryManager(35);

const cloneBackground = (background: BackgroundSettings): BackgroundSettings => ({
  ...background,
  gradientStops: background.gradientStops.map((stop) => ({ ...stop }))
});
const cloneAdjustments = (adjustments: Adjustments): Adjustments => ({ ...adjustments });
const cloneSubject = (subject: SubjectTransform): SubjectTransform => ({ ...subject });
const cloneLayers = (layers: DesignLayer[]): DesignLayer[] => layers.map((layer) => ({ ...layer }));

const initialAdjustments = (): Record<AdjustmentTarget, Adjustments> => ({
  subject: { ...DEFAULT_ADJUSTMENTS },
  background: { ...DEFAULT_ADJUSTMENTS },
  entire: { ...DEFAULT_ADJUSTMENTS }
});

export const useEditorStore = create<EditorStore>((set, get) => {
  const bump = () => set((state) => ({ renderRevision: state.renderRevision + 1 }));
  const syncHistory = () => {
    const counts = history.counts;
    set({ undoCount: counts.undo, redoCount: counts.redo });
  };
  const pushObjectHistory = <T,>(label: string, before: T, after: T, apply: (value: T) => void) => {
    history.push({ label, undo: () => apply(before), redo: () => apply(after) });
    syncHistory();
  };

  return {
    phase: 'idle',
    activeTool: 'auto',
    sourceFile: null,
    sourceUrl: '',
    originalImage: null,
    originalWidth: 0,
    originalHeight: 0,
    originalMask: null,
    workingMask: null,
    canvasSize: { width: 1, height: 1 },
    brush: { ...DEFAULT_BRUSH },
    crop: null,
    background: cloneBackground(DEFAULT_BACKGROUND),
    adjustmentTarget: 'subject',
    adjustments: initialAdjustments(),
    effect: { ...DEFAULT_EFFECT },
    subject: cloneSubject(DEFAULT_SUBJECT),
    layers: [],
    selectedLayerId: null,
    exportSettings: { ...DEFAULT_EXPORT },
    compareMode: 'final',
    comparePosition: 50,
    zoom: 1,
    pan: { x: 0, y: 0 },
    processing: null,
    provider: null,
    metrics: null,
    error: '',
    renderRevision: 0,
    autoRequest: 0,
    undoCount: 0,
    redoCount: 0,

    setActiveTool: (activeTool) => set({ activeTool }),
    beginReading: (sourceFile, sourceUrl) => set({
      phase: 'processing', sourceFile, sourceUrl, originalImage: null, error: '',
      processing: { stage: 'reading', message: 'Reading image', detail: 'Validating and decoding the selected file.' }
    }),
    beginImage: (sourceFile, sourceUrl, originalImage) => {
      history.clear();
      set({
        phase: 'processing', sourceFile, sourceUrl, originalImage,
        originalWidth: originalImage.naturalWidth, originalHeight: originalImage.naturalHeight,
        originalMask: null, workingMask: null, crop: null,
        canvasSize: { width: originalImage.naturalWidth, height: originalImage.naturalHeight },
        activeTool: 'auto', background: cloneBackground(DEFAULT_BACKGROUND), adjustments: initialAdjustments(),
        effect: { ...DEFAULT_EFFECT }, subject: cloneSubject(DEFAULT_SUBJECT), layers: [], selectedLayerId: null,
        exportSettings: { ...DEFAULT_EXPORT, filename: `${sourceFile.name.replace(/\.[^.]+$/, '')}-gxa-cutout` },
        compareMode: 'final', zoom: 1, pan: { x: 0, y: 0 }, provider: null, metrics: null, error: '',
        undoCount: 0, redoCount: 0, renderRevision: get().renderRevision + 1
      });
    },
    setProcessing: (processing) => set({ phase: 'processing', processing, error: '' }),
    setSegmented: (mask, provider, metrics) => {
      history.clear();
      set({
        phase: 'editing', processing: { stage: 'opening', message: 'Opening editor', detail: 'The editable alpha mask is ready.' },
        originalMask: cloneCanvas(mask), workingMask: cloneCanvas(mask), canvasSize: { width: mask.width, height: mask.height },
        provider, metrics, error: '', undoCount: 0, redoCount: 0, renderRevision: get().renderRevision + 1
      });
    },
    setError: (error) => set({ phase: 'error', processing: null, error }),
    resetProject: () => {
      history.clear();
      set({
        phase: 'idle', activeTool: 'auto', sourceFile: null, sourceUrl: '', originalImage: null,
        originalWidth: 0, originalHeight: 0, originalMask: null, workingMask: null,
        canvasSize: { width: 1, height: 1 }, brush: { ...DEFAULT_BRUSH }, crop: null,
        background: cloneBackground(DEFAULT_BACKGROUND), adjustmentTarget: 'subject', adjustments: initialAdjustments(),
        effect: { ...DEFAULT_EFFECT }, subject: cloneSubject(DEFAULT_SUBJECT), layers: [], selectedLayerId: null,
        exportSettings: { ...DEFAULT_EXPORT }, compareMode: 'final', comparePosition: 50, zoom: 1,
        pan: { x: 0, y: 0 }, processing: null, provider: null, metrics: null, error: '',
        undoCount: 0, redoCount: 0, renderRevision: get().renderRevision + 1
      });
    },
    requestAuto: () => set((state) => ({ autoRequest: state.autoRequest + 1 })),
    resetAutoMask: () => {
      const state = get();
      if (!state.originalMask || !state.workingMask) return;
      state.replaceWorkingMask(cloneCanvas(state.originalMask), 'Reset auto mask');
    },
    invertMask: () => {
      const state = get();
      if (!state.workingMask) return;
      const before = captureAlpha(state.workingMask);
      const context = getContext(state.workingMask, true);
      const pixels = context.getImageData(0, 0, state.workingMask.width, state.workingMask.height);
      for (let offset = 3; offset < pixels.data.length; offset += 4) pixels.data[offset] = 255 - pixels.data[offset];
      context.putImageData(pixels, 0, 0);
      state.commitMaskChange(before, 'Invert mask');
    },
    replaceWorkingMask: (mask, label) => {
      const current = get().workingMask;
      const before = current ? cloneCanvas(current) : null;
      const after = cloneCanvas(mask);
      const apply = (value: HTMLCanvasElement) => set({ workingMask: cloneCanvas(value), renderRevision: get().renderRevision + 1 });
      set({ workingMask: cloneCanvas(after), renderRevision: get().renderRevision + 1 });
      if (before) pushObjectHistory(label, before, after, apply);
    },
    captureMaskBefore: () => get().workingMask ? captureAlpha(get().workingMask!) : null,
    commitMaskChange: (before, label) => {
      const mask = get().workingMask;
      if (!mask || !before) return;
      const delta = createMaskDelta(mask, before);
      if (!delta) return;
      history.push({
        label,
        undo: () => { applyMaskDelta(mask, delta, 'before'); bump(); },
        redo: () => { applyMaskDelta(mask, delta, 'after'); bump(); }
      });
      bump();
      syncHistory();
    },
    touchMask: bump,
    setBrush: (partial) => set((state) => ({ brush: { ...state.brush, ...partial } })),
    setBackground: (partial, remember = true) => {
      const before = cloneBackground(get().background);
      const after = cloneBackground({ ...get().background, ...partial });
      const apply = (background: BackgroundSettings) => set({ background: cloneBackground(background), renderRevision: get().renderRevision + 1 });
      apply(after);
      if (remember) pushObjectHistory('Background', before, after, apply);
    },
    setAdjustmentTarget: (adjustmentTarget) => set({ adjustmentTarget }),
    setAdjustments: (target, partial, remember = true) => {
      const before = cloneAdjustments(get().adjustments[target]);
      const after = { ...before, ...partial };
      const apply = (value: Adjustments) => set((state) => ({
        adjustments: { ...state.adjustments, [target]: cloneAdjustments(value) },
        renderRevision: state.renderRevision + 1
      }));
      apply(after);
      if (remember) pushObjectHistory(`${target} adjustment`, before, after, apply);
    },
    applyEffect: (name) => {
      const beforeAdjustments = cloneAdjustments(get().adjustments.entire);
      const beforeEffect = { ...get().effect };
      const preset = EFFECT_PRESETS[name] || {};
      const afterAdjustments = { ...DEFAULT_ADJUSTMENTS, ...preset } as Adjustments;
      const afterEffect = { ...DEFAULT_EFFECT, ...preset, preset: name } as EffectSettings;
      const apply = (value: { adjustments: Adjustments; effect: EffectSettings }) => set((state) => ({
        adjustments: { ...state.adjustments, entire: { ...value.adjustments } }, effect: { ...value.effect },
        renderRevision: state.renderRevision + 1
      }));
      apply({ adjustments: afterAdjustments, effect: afterEffect });
      pushObjectHistory('Effect preset', { adjustments: beforeAdjustments, effect: beforeEffect }, { adjustments: afterAdjustments, effect: afterEffect }, apply);
    },
    setSubject: (partial, remember = true) => {
      const before = cloneSubject(get().subject);
      const after = { ...before, ...partial };
      const apply = (subject: SubjectTransform) => set({ subject: cloneSubject(subject), renderRevision: get().renderRevision + 1 });
      apply(after);
      if (remember) pushObjectHistory('Subject transform', before, after, apply);
    },
    setCrop: (crop, remember = true) => {
      const before = get().crop ? { ...get().crop! } : null;
      const after = crop ? { ...crop } : null;
      const apply = (value: CropRect | null) => set({ crop: value ? { ...value } : null, renderRevision: get().renderRevision + 1 });
      apply(after);
      if (remember) pushObjectHistory('Crop', before, after, apply);
    },
    setCropRatio: (ratio) => get().setCrop(cropForRatio(get().canvasSize, ratio)),
    setCanvasPreset: (size) => {
      const before = { ...get().canvasSize };
      const after = { ...size };
      const apply = (canvasSize: CanvasSize) => set({ canvasSize: { ...canvasSize }, crop: null, renderRevision: get().renderRevision + 1 });
      apply(after);
      pushObjectHistory('Canvas preset', before, after, apply);
    },
    addTextLayer: () => {
      const state = get();
      const layer: TextLayer = {
        id: uid('text'), type: 'text', name: 'Text', text: 'Your text', font: 'Inter, sans-serif', size: 64,
        weight: 700, color: '#111827', align: 'center', shadow: false, outline: false, outlineColor: '#ffffff',
        visible: true, locked: false, opacity: 1, x: state.canvasSize.width / 2, y: state.canvasSize.height / 2,
        rotation: 0
      };
      const before = cloneLayers(state.layers);
      const after = [...before, layer];
      const apply = (layers: DesignLayer[]) => set({ layers: cloneLayers(layers), selectedLayerId: layer.id, renderRevision: get().renderRevision + 1 });
      apply(after);
      pushObjectHistory('Add text', before, after, apply);
    },
    addShapeLayer: (shape) => {
      const state = get();
      const layer: ShapeLayer = {
        id: uid('shape'), type: 'shape', name: shape, shape, width: 260, height: 150, fill: '#2563eb',
        stroke: '#0f172a', strokeWidth: 0, visible: true, locked: false, opacity: 1,
        x: state.canvasSize.width / 2, y: state.canvasSize.height / 2, rotation: 0
      };
      const before = cloneLayers(state.layers);
      const after = [...before, layer];
      const apply = (layers: DesignLayer[]) => set({ layers: cloneLayers(layers), selectedLayerId: layer.id, renderRevision: get().renderRevision + 1 });
      apply(after);
      pushObjectHistory('Add shape', before, after, apply);
    },
    addImageLayer: (image, imageUrl) => {
      const state = get();
      const maxWidth = state.canvasSize.width * 0.45;
      const scale = Math.min(1, maxWidth / image.naturalWidth);
      const layer: ImageLayer = {
        id: uid('image'), type: 'image', name: 'Uploaded asset', image, imageUrl,
        width: image.naturalWidth * scale, height: image.naturalHeight * scale,
        visible: true, locked: false, opacity: 1, x: state.canvasSize.width / 2,
        y: state.canvasSize.height / 2, rotation: 0
      };
      const before = cloneLayers(state.layers);
      const after = [...before, layer];
      const apply = (layers: DesignLayer[]) => set({ layers: cloneLayers(layers), selectedLayerId: layer.id, renderRevision: get().renderRevision + 1 });
      apply(after);
      pushObjectHistory('Add image layer', before, after, apply);
    },
    updateLayer: (id, partial, remember = true) => {
      if (get().layers.find((layer) => layer.id === id)?.locked) return;
      const before = cloneLayers(get().layers);
      const after = before.map((layer) => layer.id === id ? ({ ...layer, ...partial } as DesignLayer) : layer);
      const apply = (layers: DesignLayer[]) => set({ layers: cloneLayers(layers), renderRevision: get().renderRevision + 1 });
      apply(after);
      if (remember) pushObjectHistory('Edit layer', before, after, apply);
    },
    selectLayer: (selectedLayerId) => set({ selectedLayerId }),
    layerAction: (id, action) => {
      const state = get();
      const before = cloneLayers(state.layers);
      const after = cloneLayers(before);
      const index = after.findIndex((layer) => layer.id === id);
      if (index < 0) return;
      if (action === 'toggle') after[index].visible = !after[index].visible;
      if (action === 'lock') after[index].locked = !after[index].locked;
      if (action === 'delete') after.splice(index, 1);
      if (action === 'duplicate') after.splice(index + 1, 0, { ...after[index], id: uid(after[index].type), name: `${after[index].name} copy` });
      if (action === 'forward' && index < after.length - 1) [after[index], after[index + 1]] = [after[index + 1], after[index]];
      if (action === 'backward' && index > 0) [after[index], after[index - 1]] = [after[index - 1], after[index]];
      const apply = (layers: DesignLayer[]) => set({ layers: cloneLayers(layers), renderRevision: get().renderRevision + 1 });
      apply(after);
      pushObjectHistory('Layer action', before, after, apply);
    },
    setExportSettings: (partial) => set((state) => ({ exportSettings: { ...state.exportSettings, ...partial } })),
    setCompareMode: (compareMode) => set({ compareMode, renderRevision: get().renderRevision + 1 }),
    setComparePosition: (comparePosition) => set({ comparePosition, renderRevision: get().renderRevision + 1 }),
    setZoom: (zoom) => set({ zoom: Math.max(0.25, Math.min(2, zoom)) }),
    setPan: (pan) => set({ pan }),
    undo: () => { history.undo(); syncHistory(); bump(); },
    redo: () => { history.redo(); syncHistory(); bump(); }
  };
});
