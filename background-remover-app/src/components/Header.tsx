import { Icon } from './Icon';

interface HeaderProps {
  editing: boolean;
  onDownload: () => void;
}

export function Header({ editing, onDownload }: HeaderProps) {
  return (
    <header className="gxa-header">
      <div className="gxa-header-inner">
        <a className="back-link" href="/" aria-label="Back to GXA Toolbox tools"><Icon name="back" /> <span>All tools</span></a>
        <a className="brand" href="/" aria-label="GXA Toolbox home">
          <span className="brand-mark"><img src="/gxa-logo.png" alt="" /></span>
          <span className="brand-name"><strong>GXA</strong><span className="brand-suffix"> Toolbox</span></span>
        </a>
        <nav className="header-links" aria-label="GXA Toolbox navigation">
          <a href="/#tools">Tools</a>
          <a href="/dashboard">Dashboard</a>
        </nav>
        <button className="primary-button header-download" type="button" onClick={onDownload} disabled={!editing}>
          <Icon name="download" /><span>Download</span>
        </button>
      </div>
    </header>
  );
}
