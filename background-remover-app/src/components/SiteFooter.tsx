const productLinks = [
  ['/help/', 'Help Center'],
  ['/guides/', 'Practical guides'],
  ['/editorial-standards/', 'Editorial standards'],
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

const socialLinks = [
  {
    platform: 'reddit',
    href: 'https://www.reddit.com/r/GXAToolbox/',
    label: 'Join Our Reddit Community',
    path: 'M20.5 11.1c-.7 0-1.3.3-1.8.8-1.6-1.1-3.8-1.8-6.2-1.9l.9-4.1 2.9.6a1.8 1.8 0 1 0 .3-1.2l-3.5-.8a.7.7 0 0 0-.8.5l-1.1 5c-2.4.1-4.5.8-6.1 1.9a2.5 2.5 0 1 0-2.8 4c0 .2-.1.5-.1.7 0 3.7 4.4 6.7 9.8 6.7s9.8-3 9.8-6.7c0-.2 0-.5-.1-.7a2.5 2.5 0 0 0-1.2-4.8ZM7.4 15.5a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8Zm8.9 4.7c-.9.9-2.3 1.3-4.3 1.3s-3.4-.4-4.3-1.3a.6.6 0 0 1 .9-.9c.6.6 1.7.9 3.4.9s2.8-.3 3.4-.9a.6.6 0 1 1 .9.9Zm.3-1.9a1.4 1.4 0 1 1 0-2.8 1.4 1.4 0 0 1 0 2.8Z'
  },
  {
    platform: 'x',
    href: 'https://x.com/gxatoolbox',
    label: 'Follow GXA Toolbox on X',
    path: 'M18.24 2.25h3.31l-7.23 8.26 8.51 11.24h-6.66l-5.21-6.82-5.97 6.82H1.68l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23Zm-1.16 17.52h1.83L7.08 4.13H5.12l11.96 15.64Z'
  },
  {
    platform: 'facebook',
    href: 'https://www.facebook.com/gxatoolbox',
    label: 'Follow GXA Toolbox on Facebook',
    path: 'M24 12.07C24 5.41 18.63 0 12 0S0 5.41 0 12.07c0 6.02 4.39 11.01 10.13 11.93v-8.44H7.08v-3.49h3.05V9.41c0-3.03 1.79-4.7 4.53-4.7 1.31 0 2.69.24 2.69.24v2.97h-1.52c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.08 24 18.09 24 12.07Z'
  },
  {
    platform: 'instagram',
    href: 'https://www.instagram.com/gxatoolbox',
    label: 'Follow GXA Toolbox on Instagram',
    path: 'M12 2.16c3.2 0 3.58.01 4.85.07 3.26.15 4.78 1.69 4.93 4.93.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.15 3.23-1.67 4.78-4.93 4.93-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-3.27-.15-4.78-1.7-4.93-4.93-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.15-3.24 1.67-4.78 4.93-4.93C8.42 2.17 8.8 2.16 12 2.16ZM12 0C8.74 0 8.33.01 7.05.07 2.7.27.27 2.69.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.2 4.36 2.63 6.78 6.98 6.98C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c4.35-.2 6.78-2.62 6.98-6.98.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95C23.73 2.69 21.3.27 16.95.07 15.67.01 15.26 0 12 0Zm0 5.84A6.16 6.16 0 1 0 12 18.16 6.16 6.16 0 0 0 12 5.84Zm0 10.16A4 4 0 1 1 12 8a4 4 0 0 1 0 8Zm6.41-11.85a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88Z'
  },
  {
    platform: 'linkedin',
    href: 'https://www.linkedin.com/in/gxatoolbox',
    label: 'Connect with GXA Toolbox on LinkedIn',
    path: 'M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V8.98h3.42v1.57h.05c.47-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.29ZM5.32 7.41a2.07 2.07 0 1 1 0-4.13 2.07 2.07 0 0 1 0 4.13Zm1.78 13.04H3.54V8.98H7.1v11.47ZM22.23 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.46c.98 0 1.77-.77 1.77-1.73V1.73C24 .77 23.21 0 22.23 0Z'
  }
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
          <nav className="gxa-site-footer-socials" aria-label="GXA Toolbox social media">
            {socialLinks.map(({ platform, href, label, path }) => (
              <a
                key={href}
                className="gxa-site-footer-social-link"
                data-platform={platform}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                data-tooltip={label}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={path} /></svg>
              </a>
            ))}
          </nav>
        </div>
        <FooterColumn title="Products" links={productLinks} />
        <FooterColumn title="Company" links={companyLinks} />
        <FooterColumn title="Legal" links={legalLinks} />
      </div>
      <div className="gxa-site-footer-bottom">© {new Date().getFullYear()} GXA Technologies. All rights reserved. GXA Toolbox is a product of GXA Technologies.</div>
    </footer>
  );
}
