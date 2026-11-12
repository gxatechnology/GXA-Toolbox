type ContentItem = { title: string; description: string };
type ToolContent = {
  about: string[];
  features: ContentItem[];
  howToUse: Array<ContentItem & { step: number }>;
  useCases: ContentItem[];
  privacy: { processingMode: string; description: string };
  supportedFormats: { input: string[]; output: string[] };
  quality?: string;
  limitations: string[];
  examples: string[];
  tips: string[];
  faqs: Array<{ question: string; answer: string }>;
  relatedTools: string[];
  relatedGuides?: Array<{ id: string; label: string }>;
};

declare global {
  interface Window {
    GXA_TOOL_CONTENT?: Record<string, ToolContent>;
    GxaToolGuideVisuals?: {
      icon: (toolId: string, description: string, index: number) => string;
      shortHeading: (toolId: string, description: string, title: string) => string;
    };
  }
}

const names: Record<string, string> = {
  'crop-image': 'Crop Image', 'compress-image': 'Compress Image', 'resize-image': 'Resize Image',
  'color-extractor': 'Color Extractor', 'image-ocr': 'Image OCR'
};

export function ToolContentGuide() {
  const content = window.GXA_TOOL_CONTENT?.['background-remover'];
  if (!content) return null;
  return <article className="tool-content-guide" aria-label="Background Remover guide">
    <section><h2>About This Tool</h2>{content.about.map(text => <p key={text}>{text}</p>)}</section>
    <section><h2>What You Can Do</h2><div className="tool-info-card-grid">{content.features.map(item => <article key={item.title}><h3>{item.title}</h3><p>{item.description}</p></article>)}</div></section>
    <section><h2>How to Use</h2><ol className="tool-steps tool-steps--visual" data-guide-tool="background-remover">{content.howToUse.map((item, index) => {
      const title = window.GxaToolGuideVisuals?.shortHeading('background-remover', item.description, item.title) || item.title;
      const icon = window.GxaToolGuideVisuals?.icon('background-remover', item.description, index) || '';
      return <li className="tool-guide-step" key={item.step}>
        <div className="tool-guide-step__art" aria-hidden="true" dangerouslySetInnerHTML={{ __html: icon }} />
        <div className="tool-guide-step__copy"><span className="tool-guide-step__number">Step {item.step}</span><h3>{title}</h3>{item.description.trim().replace(/[.!?]+$/, '') !== title.trim().replace(/[.!?]+$/, '') && <p>{item.description}</p>}</div>
      </li>;
    })}</ol></section>
    <section><h2>Practical Use Cases</h2><div className="tool-info-card-grid">{content.useCases.map(item => <article key={item.title}><h3>{item.title}</h3><p>{item.description}</p></article>)}</div></section>
    <section><h2>Privacy and File Processing</h2><div className="tool-info-note"><strong>{content.privacy.processingMode}</strong><p>{content.privacy.description}</p></div></section>
    <section><h2>Supported Inputs and Outputs</h2><div className="tool-format-grid"><div><h3>Input</h3><ul>{content.supportedFormats.input.map(item => <li key={item}>{item}</li>)}</ul></div><div><h3>Output</h3><ul>{content.supportedFormats.output.map(item => <li key={item}>{item}</li>)}</ul></div></div></section>
    {content.quality && <section><h2>Quality and Fidelity</h2><div className="tool-info-note"><p>{content.quality}</p></div></section>}
    <section><h2>Limitations and Important Notes</h2><ul>{content.limitations.map(item => <li key={item}>{item}</li>)}</ul></section>
    {!!content.examples.length && <section><h2>Worked Example</h2>{content.examples.map(item => <div className="tool-example" key={item}><p>{item}</p></div>)}</section>}
    <section><h2>Helpful Tips</h2><ul>{content.tips.map(item => <li key={item}>{item}</li>)}</ul></section>
    <section><h2>Frequently Asked Questions</h2><div className="tool-faq-list">{content.faqs.map(item => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div></section>
    <section><h2>Related Tools</h2><div className="tool-related-links">{content.relatedTools.map(id => <a key={id} href={`/${id}/`}>{names[id] || id.replace(/-/g, ' ')}</a>)}</div></section>
    {!!content.relatedGuides?.length && <section><h2>Related Guides</h2><div className="tool-related-links">{content.relatedGuides.map(link => <a key={link.id} href={`/${link.id}/`}>{link.label}</a>)}</div></section>}
  </article>;
}
