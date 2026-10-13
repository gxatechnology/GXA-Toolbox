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
      <nav className="tool-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">&gt;</span><span>IMAGE</span><span aria-hidden="true">&gt;</span><span>Background Remover</span></nav>
      <section className="upload-intro">
        <span className="eyebrow">Image tool</span>
        <h1>Background Remover</h1>
        <p>Automatically detect the foreground, refine the alpha mask, create a new composition, and export at the source resolution.</p>
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
        <h2>Drop your file here</h2>
        <p>or click to browse from device</p>
        <button type="button" className="primary-button" onClick={(event) => { event.stopPropagation(); choose(); }}>Select image</button>
        <div className="format-row"><span>JPG</span><span>PNG</span><span>WEBP</span><span>Single file</span><small>Up to 30 MB</small></div>
        <input ref={input} hidden type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={(event) => accept(event.target.files)} />
      </section>
      {error && <div className="error-banner" role="alert"><strong>Could not process that image.</strong><span>{error}</span></div>}
      <ul className="upload-highlights" aria-label="Background Remover capabilities">
        <li><strong>Editable cutout</strong><span>Erase, restore, and refine the generated alpha mask.</span></li>
        <li><strong>Flexible background</strong><span>Keep transparency or add a solid, gradient, or image background.</span></li>
        <li><strong>Full-resolution export</strong><span>Crop and download the rendered result at its working resolution.</span></li>
      </ul>
      <section className="flow-cards" aria-label="Background Remover workflow">
        <article><strong>1</strong><span>Upload</span><small>Preview appears immediately</small></article>
        <article><strong>2</strong><span>Auto cutout</span><small>GXA Vision Model processing</small></article>
        <article><strong>3</strong><span>Edit & export</span><small>Real mask and local rendering</small></article>
      </section>
    </main>
  );
}
