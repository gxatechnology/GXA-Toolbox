import type { ProcessingState } from '../types/editor';
import { Icon } from './Icon';

const stages = ['Reading image', 'Loading removal engine', 'Segmenting', 'Creating mask', 'Opening editor'];

interface ProcessingScreenProps {
  sourceUrl: string;
  processing: ProcessingState | null;
  onCancel: () => void;
}

export function ProcessingScreen({ sourceUrl, processing, onCancel }: ProcessingScreenProps) {
  const labels: Record<string, number> = { reading: 0, loading: 1, segmenting: 2, masking: 3, opening: 4 };
  const active = labels[processing?.stage || 'reading'];
  return (
    <main className="processing-page">
      <div className="processing-preview"><img src={sourceUrl} alt="Selected source preview" /></div>
      <div className="processing-card">
        <span className="processing-orbit"><Icon name="auto" size={30} /></span>
        <span className="eyebrow">Background Remover</span>
        <h1>{processing?.message || 'Reading image'}</h1>
        <p>{processing?.detail || 'Validating and decoding the selected image.'}</p>
        <ol className="processing-stages">
          {stages.map((stage, index) => <li key={stage} className={index < active ? 'done' : index === active ? 'active' : ''}><span>{index < active ? '✓' : index + 1}</span>{stage}</li>)}
        </ol>
        <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>
      </div>
    </main>
  );
}
