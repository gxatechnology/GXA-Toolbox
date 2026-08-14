const productLinks = [
  ['/merge-pdf/', 'Merge PDF'],
  ['/compress-image/', 'Compress Image'],
  ['/color-extractor/', 'Color Extractor'],
  ['/password-generator/', 'Password Tool']
] as const;

const companyLinks = [
  ['/about/', 'About Us'],
  ['/careers/', 'Careers'],
  ['/security/', 'Security Policies'],
  ['/?support=1', 'Contact Support']
] as const;

const legalLinks = [
  ['/privacy-policy/', 'Privacy Policy'],
  ['/terms/', 'Terms of Service'],
  ['/gdpr/', 'GDPR Compliance']
] as const;

function FooterColumn({ title, links }: { title: string; links: readonly (readonly [string, string])[] }) {
  return (
    <nav className="gxa-site-footer-column" aria-label={`${title} links`}>
      <strong>{title}</strong>
      {links.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer className="gxa-site-footer">
      <div className="gxa-site-footer-inner">
        <div className="gxa-site-footer-brand">
          <a href="/" aria-label="GXA Toolbox home">
            <img src="/gxa-logo.png" width="256" height="256" decoding="async" alt="" />
            <span>GXA Toolbox</span>
          </a>
          <p>Your Complete Digital Toolbox</p>
        </div>
        <FooterColumn title="Products" links={productLinks} />
        <FooterColumn title="Company" links={companyLinks} />
        <FooterColumn title="Legal" links={legalLinks} />
      </div>
      <div className="gxa-site-footer-bottom">© {new Date().getFullYear()} GXA Technologies. All rights reserved. GXA Toolbox is a product of GXA Technologies.</div>
    </footer>
  );
}
