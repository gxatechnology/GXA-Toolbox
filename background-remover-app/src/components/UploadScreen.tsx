import { useRef, useState, type DragEvent } from 'react';
import { Icon } from './Icon';

interface UploadScreenProps {
  error?: string;
  onFile: (file: File) => void;
}

export function UploadScreen({ error, onFile }: UploadScreenProps) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const choose = () => input.current?.click();
  const accept = (files: FileList | null) => files?.[0] && onFile(files[0]);
  const drop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    accept(event.dataTransfer.files);
  };
  return (
    <main className="upload-page">
      <section className="upload-intro">
        <span className="eyebrow">Browser-local image tool</span>
        <h1>Background Remover</h1>
        <p>Automatically detect the foreground, refine the alpha mask, create a new composition, and export at the source resolution.</p>
        <div className="privacy-note"><Icon name="shield" /> Processed privately in your browser</div>
      </section>
      <section
        className={`drop-zone ${dragging ? 'dragging' : ''}`}
        onClick={choose}
        onKeyDown={(event) => (event.key === 'Enter' || event.key === ' ') && choose()}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
        role="button"
        tabIndex={0}
        aria-label="Choose an image for Background Remover"
      >
        <span className="upload-icon"><Icon name="upload" size={34} /></span>
        <h2>Choose an image</h2>
        <p>or drop a JPG, PNG, or WEBP here</p>
        <button type="button" className="primary-button" onClick={(event) => { event.stopPropagation(); choose(); }}>Explore your files</button>
        <div className="format-row"><span>JPG</span><span>PNG</span><span>WEBP</span><small>Up to 30 MB</small></div>
        <input ref={input} hidden type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={(event) => accept(event.target.files)} />
      </section>
      {error && <div className="error-banner" role="alert"><strong>Could not process that image.</strong><span>{error}</span></div>}
      <section className="flow-cards" aria-label="Background Remover workflow">
        <article><strong>1</strong><span>Upload</span><small>Preview appears immediately</small></article>
        <article><strong>2</strong><span>Auto cutout</span><small>WebGPU with WASM fallback</small></article>
        <article><strong>3</strong><span>Edit & export</span><small>Real mask and local rendering</small></article>
      </section>
    </main>
  );
}
