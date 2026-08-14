(function registerGxaContentPages(global) {
  'use strict';

  const pages = [
    {
      id: 'about',
      name: 'About Us',
      title: 'About GXA Toolbox | GXA Toolbox',
      description: 'Learn how GXA Toolbox and GXA Technologies provide practical browser-based tools for documents, images, conversions, developer tasks, and calculations.',
      eyebrow: 'About GXA Toolbox',
      intro: 'GXA Toolbox is a browser-based digital utility platform developed and maintained by GXA Technologies. It brings practical document, image, conversion, archive, developer, and calculation tools together in one accessible workspace.',
      sections: [
        {
          id: 'what-we-do',
          title: 'What GXA Toolbox does',
          paragraphs: [
            'The platform is designed to make common digital tasks easier to complete without installing a separate desktop application for every job. Each tool has a focused workspace, clear inputs, and a downloadable result where the tool produces an output file.'
          ],
          bullets: [
            'PDF organization, editing, extraction, conversion, and document utilities.',
            'Image compression, resizing, cropping, background removal, and related image workflows.',
            'File conversion, ZIP and archive utilities, QR and barcode tools, and developer helpers.',
            'Everyday calculators for finance, dates, percentages, measurements, and other practical tasks.'
          ]
        },
        {
          id: 'privacy-and-processing',
          title: 'A practical, privacy-conscious approach',
          paragraphs: [
            'Many GXA Toolbox tools are designed to process selected files locally in the browser where the required browser capabilities are available. This can reduce unnecessary file transfers and lets users work directly with the files they choose.',
            'Processing behavior depends on the individual tool. Some features use browser APIs, WebAssembly, local models, or third-party libraries, and account or support features transmit the information needed to provide those services. Tool-specific notices and the Privacy Policy explain important differences.'
          ]
        },
        {
          id: 'product-principles',
          title: 'Product principles',
          paragraphs: [
            'GXA Toolbox is built around useful outcomes rather than unnecessary complexity. The product emphasizes clear controls, responsive layouts, accessible interactions, honest capability messaging, and dependable downloads across desktop and mobile browsers.'
          ],
          bullets: [
            'Usability: focused interfaces and straightforward workflows.',
            'Performance: tool-specific engines are loaded when they are needed where practical.',
            'Accessibility: keyboard, touch, responsive layouts, and meaningful labels are part of the shared interface.',
            'Transparency: limitations and processing requirements should be described rather than hidden.'
          ]
        },
        {
          id: 'gxa-technologies',
          title: 'A product of GXA Technologies',
          paragraphs: [
            'GXA Toolbox is a product of GXA Technologies. GXA Technologies develops and maintains the platform, its shared experience, and the supporting account and deployment architecture.',
            'This page does not claim offices, certifications, partnerships, awards, customer totals, or other company facts that are not established by the product repository.'
          ]
        }
      ],
      related: [
        { id: 'security', label: 'Security Policies' },
        { id: 'privacy-policy', label: 'Privacy Policy' }
      ],
      cta: {
        title: 'Questions about GXA Toolbox?',
        text: 'Use Contact Support for product questions, feedback, or help with an existing tool.',
        label: 'Contact Support'
      }
    },
    {
      id: 'careers',
      name: 'Careers',
      title: 'Careers at GXA Technologies | GXA Toolbox',
      description: 'Read current careers information for GXA Technologies and learn how to express interest in future opportunities related to GXA Toolbox.',
      eyebrow: 'Careers',
      intro: 'GXA Toolbox is developed and maintained by GXA Technologies. We do not currently list public vacancies on this page.',
      sections: [
        {
          id: 'current-opportunities',
          title: 'Current opportunities',
          paragraphs: [
            'There are no active positions, salary ranges, benefits packages, or application deadlines published here. A role should not be treated as open unless GXA Technologies publishes it through an official channel.',
            'This approach keeps the page accurate and avoids collecting applications for positions that do not exist.'
          ]
        },
        {
          id: 'future-interest',
          title: 'Expressing future interest',
          paragraphs: [
            'People interested in future engineering, product, design, accessibility, quality, or operations opportunities may send a short introduction through Contact Support. Use the message field to state that the inquiry concerns careers.',
            'An expression of interest is not an application to an active vacancy and does not guarantee a response, interview, or future opening.'
          ]
        },
        {
          id: 'what-to-share',
          title: 'What to share',
          paragraphs: [
            'A concise summary of relevant experience, the kind of work you are interested in, and a link to a professional portfolio or profile is sufficient for an initial message. Do not send passwords, government identifiers, financial information, or other sensitive personal data through the support form.'
          ]
        },
        {
          id: 'recruitment-safety',
          title: 'Recruitment safety',
          paragraphs: [
            'GXA Technologies does not publish job offers, compensation promises, or recruiter identities on this page. Verify any future recruitment communication before sharing personal information or making a payment.'
          ]
        }
      ],
      related: [
        { id: 'about', label: 'About Us' },
        { id: 'privacy-policy', label: 'Privacy Policy' }
      ],
      cta: {
        title: 'Interested in future opportunities?',
        text: 'Send a brief careers inquiry through the existing support channel.',
        label: 'Contact GXA Technologies'
      }
    },
    {
      id: 'security',
      name: 'Security Policies',
      title: 'Security Policies | GXA Toolbox',
      description: 'Review GXA Toolbox security practices for browser processing, accounts, sessions, file handling, dependencies, and responsible issue reporting.',
      eyebrow: 'Security at GXA Toolbox',
      intro: 'GXA Toolbox uses layered browser, application, account, and hosting controls appropriate to its current architecture. This page describes implemented practices and important user responsibilities without claiming a formal security certification.',
      sections: [
        {
          id: 'browser-processing',
          title: 'Browser-local processing where applicable',
          paragraphs: [
            'Many file tools process selected content in browser memory using browser APIs, JavaScript, WebAssembly, or a locally loaded model. When a workflow is browser-local, the tool can operate without intentionally sending the file contents to the account history service.',
            'Not every browser supports every capability, and some tools load code, models, language data, or other components from the site or a third-party CDN. Users should review the disclosure shown by the selected tool.'
          ]
        },
        {
          id: 'transport-and-hosting',
          title: 'Production transport and hosting',
          paragraphs: [
            'The production website is served over HTTPS. Netlify hosts the generated static site and account functions, and the deployment sends security headers that restrict framing, MIME sniffing, object embedding, and form destinations.',
            'HTTPS protects data in transit between a compatible browser and the production host. It does not eliminate risks on a compromised device, unsafe browser extension, malicious file, or third-party network outside GXA Toolbox control.'
          ]
        },
        {
          id: 'accounts-and-passwords',
          title: 'Accounts, passwords, and sessions',
          paragraphs: [
            'Account passwords are validated and stored as bcrypt password hashes rather than intentional plaintext password records. Authentication requests are same-origin checked, request sizes are limited, and account responses are marked no-store.',
            'The production session is represented by a signed cookie configured as HttpOnly, Secure, SameSite=Lax, with a seven-day maximum age. Session signatures use a deployment secret that is not embedded in public browser code.'
          ],
          note: 'Users remain responsible for choosing a unique password, protecting access to their email and device, and signing out on shared devices.'
        },
        {
          id: 'files-and-history',
          title: 'Files and processing history',
          paragraphs: [
            'The account history service records processing metadata for signed-in users, such as tool name, original and output filenames, file size, status, timing, and limited tool metadata. Its current schema does not store uploaded file contents.',
            'Files may still remain in browser memory, object URLs, downloads, temporary operating-system locations, or browser-managed storage during a session. Close sensitive workspaces, remove downloads when no longer needed, and clear site data on shared devices.'
          ]
        },
        {
          id: 'dependencies',
          title: 'Third-party components and supply chain',
          paragraphs: [
            'The application uses established browser libraries, fonts, hosting services, and content-delivery networks. Some heavy tool engines and model files are self-hosted; other libraries or data files are loaded from providers such as Google Fonts, unpkg, cdnjs, and jsDelivr.',
            'Dependencies are limited and pinned where practical, but no software supply chain is risk-free. Availability, browser policy, and upstream changes can affect a tool.'
          ]
        },
        {
          id: 'limitations',
          title: 'Security limitations',
          paragraphs: [
            'GXA Toolbox does not claim ISO, SOC 2, PCI DSS, HIPAA, penetration-testing, or bug-bounty certification. No online service can guarantee absolute security.',
            'Do not use the service to process content when a legal, contractual, or organizational policy requires a separately approved environment. Keep backups of important originals and inspect downloaded results before relying on them.'
          ]
        },
        {
          id: 'reporting',
          title: 'Responsible security reporting',
          paragraphs: [
            'Report a suspected vulnerability through Contact Support with a clear description, affected route, reproduction steps, and potential impact. Do not include live passwords, private files, access tokens, or personal data in the report.',
            'Do not disrupt the service, access another person\'s account, exfiltrate data, or perform destructive testing. GXA Technologies may request additional information needed to reproduce and address a report.'
          ]
        }
      ],
      related: [
        { id: 'privacy-policy', label: 'Privacy Policy' },
        { id: 'terms', label: 'Terms of Service' }
      ],
      cta: {
        title: 'Report a security issue',
        text: 'Send a responsible report through Contact Support without including secrets or private files.',
        label: 'Report an Issue'
      }
    },
    {
      id: 'privacy-policy',
      name: 'Privacy Policy',
      title: 'Privacy Policy | GXA Toolbox',
      description: 'Understand how GXA Toolbox handles account information, files, processing history, cookies, local storage, support messages, analytics, and third-party services.',
      eyebrow: 'Privacy Policy',
      updated: '14 August 2026',
      intro: 'This Privacy Policy explains how GXA Technologies handles information in connection with GXA Toolbox. The platform combines browser-local tools, optional accounts, support features, hosting services, and Google Tag Manager, so it would be inaccurate to claim that no data is processed.',
      sections: [
        {
          id: 'scope',
          title: 'Scope and service provider',
          paragraphs: [
            'This policy applies to the public GXA Toolbox website, generated tool routes, the Background Remover application, account features, and support interactions operated for GXA Toolbox by GXA Technologies.',
            'External websites, browser extensions, downloaded files, and third-party services have their own practices. Links or embedded resources do not make GXA Technologies responsible for an external provider\'s policy.'
          ]
        },
        {
          id: 'information-you-provide',
          title: 'Information you provide',
          paragraphs: [
            'Creating an account requires a full name, email address, and password. The password is transformed into a bcrypt hash for storage; it is not intended to be stored as plaintext. Account records also include role, status, premium status, and timestamps.',
            'A support request can include the name, email address, and message entered in the Contact Support form. Careers, privacy, security, and other inquiries sent through that form are processed as support messages.'
          ]
        },
        {
          id: 'files-and-results',
          title: 'Files, tool inputs, and results',
          paragraphs: [
            'Many registered tools are designed to process selected files in browser memory. In those workflows, file contents are not intentionally uploaded to the account history endpoint. Results are normally made available through the browser for download.',
            'Processing differs by tool. A tool may use browser APIs, WebAssembly, local models, or third-party code and data loaded over the network. If a tool or future feature requires server processing, the information needed for that request may be transmitted to the relevant endpoint and should be described in the tool interface.',
            'Browser-local processing does not prevent files from remaining in browser memory, temporary object URLs, downloads, operating-system storage, backups, or other locations controlled by the user\'s device.'
          ]
        },
        {
          id: 'history',
          title: 'Account and processing history',
          paragraphs: [
            'For signed-in users, the service may store processing-history metadata including tool name, original and output filenames, file size, status, processing time, limited tool metadata, and timestamps. The current history schema does not contain a field for uploaded file contents.',
            'The dashboard retrieves recent history associated with the authenticated account. Users should avoid placing sensitive personal data in filenames when they do not want that information recorded in account history.'
          ]
        },
        {
          id: 'cookies-and-storage',
          title: 'Cookies and browser storage',
          paragraphs: [
            'Authentication uses a signed session cookie named gxa_toolbox_session. In production it is configured as HttpOnly, Secure, SameSite=Lax, and has a maximum age of seven days. The cookie supports sign-in and account access and can be cleared by signing out or clearing site data.',
            'Local storage is used for theme preferences, favorites, recent tools, recent searches, local history compatibility, and an email address only when the user selects the remember-email option. Local storage remains on the device until the application or user clears it.',
            'Analytics or other tags managed through Google Tag Manager may use cookies or similar technologies depending on the published container configuration and consent settings.',
            'GXA Toolbox loads the official Google AdSense site code so the domain can be reviewed for advertising and Auto Ads can be enabled after account approval and configuration. When advertising is active, Google and its advertising partners may use cookies, identifiers, or similar technologies to deliver, limit, measure, and protect ads, subject to applicable consent requirements and the active AdSense settings.'
          ]
        },
        {
          id: 'analytics-and-logs',
          title: 'Analytics, diagnostics, and hosting logs',
          paragraphs: [
            'GXA Toolbox includes Google Tag Manager to manage measurement tags. Google Analytics 4 may be configured through that container; the website source does not directly install a separate GA4 gtag.js loader. When enabled, measurement may include pages viewed, interactions, browser and device information, referrer information, approximate location derived from network information, and analytics identifiers, subject to the active tag and consent configuration.',
            'Hosting and network providers may process request information such as IP address, user agent, requested path, time, response status, and diagnostic logs to deliver, secure, and troubleshoot the service.'
          ]
        },
        {
          id: 'third-parties',
          title: 'Third-party services',
          paragraphs: [
            'The current architecture uses Netlify for hosting, functions, and database connectivity; Google Tag Manager, Google AdSense, and Google-hosted fonts; and content-delivery networks such as unpkg, cdnjs, and jsDelivr for selected libraries, workers, fonts, language data, or tool dependencies.',
            'These providers may receive network and device information needed to deliver their resources. Their independent processing is governed by their own terms and privacy notices.'
          ]
        },
        {
          id: 'purposes',
          title: 'Why information is processed',
          bullets: [
            'Provide tools, account access, downloads, preferences, support, and requested service features.',
            'Authenticate users, maintain sessions, display account history, and protect the service from misuse.',
            'Measure usage and diagnose reliability or performance where analytics or logs are enabled.',
            'Prepare, deliver, measure, secure, and limit advertising when AdSense is approved and advertising is enabled.',
            'Respond to legal requests, enforce terms, and protect users, GXA Technologies, and the public where required.'
          ]
        },
        {
          id: 'retention',
          title: 'Retention',
          paragraphs: [
            'Account records, processing-history metadata, and support messages may be retained for as long as reasonably needed to provide the service, maintain account records, respond to inquiries, address security or legal needs, and resolve disputes. The repository does not define one universal deletion period for every record type.',
            'Session cookies expire or are cleared as described above. Browser local storage remains until cleared. Hosting and analytics providers apply their own configured retention periods. A verified deletion request will be assessed against operational and legal retention needs.'
          ]
        },
        {
          id: 'security',
          title: 'Security',
          paragraphs: [
            'GXA Technologies uses measures reflected in the current architecture, including HTTPS, password hashing, signed session tokens, same-origin request checks, response security headers, data minimization, and browser-local processing where appropriate.',
            'No online system is completely secure. Users should protect account credentials, use trusted devices, review downloaded results, and avoid submitting information that is not needed for the selected task.'
          ]
        },
        {
          id: 'choices',
          title: 'Your choices and requests',
          paragraphs: [
            'Users can avoid creating an account for public tools that do not require one, decline the remember-email option, clear cookies and local storage, control browser permissions, and use browser privacy controls. Blocking required storage or scripts may prevent some features from working.',
            'Requests to access, correct, or delete account or support information can be submitted through Contact Support. GXA Technologies may need to verify identity and may retain information when required for security, legal, or legitimate operational reasons.'
          ]
        },
        {
          id: 'children-international-changes',
          title: 'Children, international users, and policy changes',
          paragraphs: [
            'GXA Toolbox is a general utility service and is not intentionally directed to children who cannot lawfully consent to the relevant processing. A parent or guardian who believes a child submitted personal information should contact GXA Technologies.',
            'Users may access the service from countries different from the locations used by GXA Technologies and its providers. This can involve international processing subject to applicable safeguards and provider arrangements.',
            'This policy may change as the product, law, or provider configuration changes. Material revisions will be published on this route with an updated date.'
          ]
        }
      ],
      related: [
        { id: 'gdpr', label: 'GDPR Information' },
        { id: 'security', label: 'Security Policies' },
        { id: 'terms', label: 'Terms of Service' }
      ],
      cta: {
        title: 'Privacy question or request?',
        text: 'Use Contact Support and clearly state that your message concerns privacy or personal data.',
        label: 'Contact About Privacy'
      }
    },
    {
      id: 'terms',
      name: 'Terms of Service',
      title: 'Terms of Service | GXA Toolbox',
      description: 'Read the GXA Toolbox terms covering permitted use, accounts, user files, tool outputs, availability, limitations, and responsible service use.',
      eyebrow: 'Terms of Service',
      updated: '14 August 2026',
      intro: 'These Terms of Service govern access to GXA Toolbox, a product developed and maintained by GXA Technologies. By using the service, you agree to use it lawfully and responsibly and acknowledge the technical limitations described below.',
      sections: [
        {
          id: 'acceptance',
          title: 'Acceptance and eligibility',
          paragraphs: [
            'Use of GXA Toolbox constitutes acceptance of these terms and the Privacy Policy. If you do not agree, do not use the service.',
            'You must be able to enter into these terms under the law applicable to you. If you use the service for an organization, you are responsible for having authority to do so and for following that organization\'s policies.'
          ]
        },
        {
          id: 'service',
          title: 'The service',
          paragraphs: [
            'GXA Toolbox provides browser-based tools for PDFs, images, conversions, ZIP files, developer tasks, QR and barcode workflows, calculations, and related productivity activities. Features may rely on browser APIs, WebAssembly, local models, third-party libraries, or network services.',
            'Public tools may be available without an account. Account features can include a dashboard and processing-history metadata.'
          ]
        },
        {
          id: 'permitted-use',
          title: 'Permitted use',
          paragraphs: [
            'You may use the service for lawful personal or organizational tasks consistent with these terms and the rights of other people. You are responsible for evaluating whether a tool is suitable for your intended purpose.'
          ],
          bullets: [
            'Keep a backup of important source files before processing.',
            'Review outputs for accuracy, completeness, formatting, and safety before relying on them.',
            'Follow applicable copyright, privacy, employment, financial, records-management, and data-protection requirements.'
          ]
        },
        {
          id: 'prohibited-use',
          title: 'Prohibited misuse',
          bullets: [
            'Do not use the service to violate law, infringe rights, distribute malware, or process content you are not authorized to use.',
            'Do not attempt to access another user\'s account, bypass access controls, extract secrets, disrupt infrastructure, or overload the service.',
            'Do not probe or exploit vulnerabilities outside a responsible, non-destructive report to GXA Technologies.',
            'Do not misrepresent tool output as professionally verified when it has not been independently reviewed.'
          ]
        },
        {
          id: 'user-content',
          title: 'Your files and content',
          paragraphs: [
            'You retain responsibility for files, text, images, data, and instructions you select or enter. You represent that you have the rights and permissions needed to process that content.',
            'Browser-local operation does not change your legal obligations. Do not process confidential, regulated, or restricted material unless this service and your device are approved for that use.'
          ]
        },
        {
          id: 'accounts',
          title: 'Account responsibilities',
          paragraphs: [
            'Provide accurate account information, maintain a unique password, protect access to the associated email and device, and notify GXA Technologies through Contact Support if you suspect unauthorized account activity.',
            'You are responsible for activity performed through your account until access is secured. Account access may be limited or suspended when reasonably necessary to address abuse, security, legal requirements, or material violations of these terms.'
          ]
        },
        {
          id: 'outputs',
          title: 'Outputs and conversion limitations',
          paragraphs: [
            'File conversion, extraction, compression, recognition, rendering, and calculation results can differ from the source or from results produced by other software. Complex layouts, fonts, metadata, formulas, color profiles, encryption, damaged files, browser limits, and dependency limits can affect an output.',
            'GXA Toolbox does not guarantee perfect accuracy, fidelity, completeness, recoverability, or fitness for a specific professional, legal, financial, medical, archival, or compliance purpose. Unsupported or dependency-limited conversions may be unavailable or incomplete.'
          ]
        },
        {
          id: 'intellectual-property',
          title: 'Intellectual property',
          paragraphs: [
            'GXA Technologies and its licensors retain rights in the GXA Toolbox branding, interface, original software, documentation, and service materials. Third-party libraries and assets remain subject to their own licenses.',
            'These terms do not transfer ownership of your source content to GXA Technologies. They also do not grant permission to copy, resell, or misrepresent the GXA Toolbox service or brand.'
          ]
        },
        {
          id: 'availability',
          title: 'Availability and changes',
          paragraphs: [
            'Tools may change, be corrected, experience downtime, or become unavailable because of maintenance, browser changes, provider outages, security needs, legal requirements, or third-party dependency changes. GXA Technologies does not promise uninterrupted availability.',
            'Routes and registered tools will be preserved where practical, but no feature is guaranteed to remain unchanged forever.'
          ]
        },
        {
          id: 'disclaimers-liability',
          title: 'Disclaimers and liability',
          paragraphs: [
            'The service is provided on an as-available basis. To the extent permitted by applicable law, GXA Technologies disclaims implied warranties that cannot be supported by the current product, including uninterrupted operation and error-free or perfectly faithful output.',
            'To the extent permitted by applicable law, GXA Technologies is not responsible for indirect, incidental, special, consequential, or lost-data losses arising from use of or inability to use the service. Nothing in these terms excludes liability that cannot lawfully be excluded. Users should maintain backups and independently verify important results.'
          ]
        },
        {
          id: 'general',
          title: 'Changes, severability, and contact',
          paragraphs: [
            'These terms may be updated as the service or applicable requirements change. Continued use after an updated version is published indicates acceptance of the revised terms to the extent permitted by law.',
            'If a provision is found unenforceable, the remaining provisions continue to apply. Applicable law and dispute rules depend on the circumstances and governing legal requirements; these terms do not invent a registered office or unsupported jurisdiction.',
            'Questions about these terms can be sent through Contact Support.'
          ]
        }
      ],
      related: [
        { id: 'privacy-policy', label: 'Privacy Policy' },
        { id: 'security', label: 'Security Policies' }
      ],
      cta: {
        title: 'Questions about these terms?',
        text: 'Use Contact Support and identify the Terms of Service section involved.',
        label: 'Contact Support'
      }
    },
    {
      id: 'gdpr',
      name: 'GDPR Compliance',
      title: 'GDPR Information | GXA Toolbox',
      description: 'Review GXA Toolbox GDPR compliance practices, personal-data categories, lawful bases, rights, cookies, processors, transfers, retention, and request procedures.',
      eyebrow: 'GDPR information',
      updated: '14 August 2026',
      intro: 'This page summarizes GDPR compliance practices for GXA Toolbox users in the European Economic Area and United Kingdom. It is not a claim of formal GDPR certification and should be read with the Privacy Policy.',
      sections: [
        {
          id: 'roles-and-scope',
          title: 'Roles and scope',
          paragraphs: [
            'GXA Technologies determines the purposes and means of processing personal data used to provide GXA Toolbox accounts, support, service operation, and measurement, except where a third-party provider acts independently under its own terms.',
            'The exact GDPR role can depend on the activity and user relationship. Organizations using the tools remain responsible for determining their own obligations for files and personal data they choose to process.'
          ]
        },
        {
          id: 'data-categories',
          title: 'Personal data that may be processed',
          bullets: [
            'Account details such as name, email, password hash, role, status, and account timestamps.',
            'Support information such as name, email, message content, and related correspondence.',
            'Processing-history metadata such as filenames, tool name, output name, size, status, timing, and timestamps for signed-in users.',
            'Device, browser, network, referrer, page, interaction, cookie, and analytics information from hosting logs or tags configured through Google Tag Manager.',
            'File contents when a selected feature genuinely requires transmission; many current tools instead process file contents locally in the browser.'
          ]
        },
        {
          id: 'lawful-bases',
          title: 'Lawful bases',
          paragraphs: [
            'Depending on the activity, processing may rely on performance of a contract or steps requested by the user, legitimate interests in operating and securing the service, consent for optional cookies or measurement where required, or compliance with legal obligations.',
            'When legitimate interests are used, GXA Technologies considers the service need, data minimization, user expectations, and potential impact. When consent is the basis, it may be withdrawn for future processing.'
          ]
        },
        {
          id: 'minimization',
          title: 'Data minimization and browser processing',
          paragraphs: [
            'The service is designed to keep many file-processing operations in browser memory where technically possible. Account history records metadata rather than uploaded file content under the current schema.',
            'Users can further minimize data by using public tools without an account where available, avoiding personal data in filenames, declining remembered-email storage, limiting support-message content, and clearing browser storage.'
          ]
        },
        {
          id: 'rights',
          title: 'EEA and UK data rights',
          paragraphs: [
            'Subject to the conditions and exceptions in applicable law, a person may request access to personal data, correction of inaccurate data, deletion, restriction of processing, objection to processing, and data portability for applicable data supplied in a structured form.',
            'Where processing depends on consent, consent may be withdrawn without affecting processing that was lawful before withdrawal. Users may also have the right to complain to the data-protection authority in their country or region.'
          ]
        },
        {
          id: 'requests',
          title: 'Submitting a rights request',
          paragraphs: [
            'Submit a request through Contact Support and state that it is a GDPR or privacy request. Describe the account email, information, and right involved without including a password or unnecessary identity document in the initial message.',
            'GXA Technologies may request proportionate information to verify identity, clarify scope, protect another person\'s rights, or meet legal obligations. A request may be limited or refused when applicable law permits, with an explanation where required.'
          ]
        },
        {
          id: 'cookies-consent',
          title: 'Cookies, analytics, and consent',
          paragraphs: [
            'A signed session cookie supports requested account access. Local storage supports preferences and optional convenience features. Google Tag Manager manages measurement tags, and GA4 may be configured through that container.',
            'Where applicable law requires consent for optional analytics or advertising technologies, those tags should be governed by the active consent configuration. Users can also use browser controls to limit or clear cookies and local storage, although required account features may stop working.'
          ]
        },
        {
          id: 'processors-transfers',
          title: 'Providers and international transfers',
          paragraphs: [
            'GXA Toolbox uses providers for hosting, functions, database connectivity, fonts, tag management, analytics when configured, and content delivery. These currently include Netlify, Google services, unpkg, cdnjs, and jsDelivr for relevant functions or resources.',
            'Providers may process data in countries outside the user\'s location. Where GDPR transfer rules apply, transfers should rely on an applicable adequacy decision, contractual safeguards, provider mechanism, or other lawful basis appropriate to the relationship.'
          ]
        },
        {
          id: 'retention-security',
          title: 'Retention and security practices',
          paragraphs: [
            'Personal data is retained according to service, account, support, security, dispute, and legal needs rather than one unsupported universal period. Browser storage remains until cleared, the production session cookie has a seven-day maximum age, and providers apply configured retention to logs and analytics.',
            'Current safeguards include HTTPS, bcrypt password hashing, signed session cookies, same-origin checks, response headers, authenticated history isolation, and browser-local processing where appropriate. These measures reduce risk but cannot guarantee absolute security.'
          ]
        },
        {
          id: 'updates-contact',
          title: 'Updates and contact',
          paragraphs: [
            'These practices may change as the service, provider configuration, or applicable law changes. Updates will be published on this route and reflected in the Privacy Policy.',
            'Use Contact Support for GDPR questions, rights requests, consent concerns, or questions about an international transfer.'
          ]
        }
      ],
      related: [
        { id: 'privacy-policy', label: 'Privacy Policy' },
        { id: 'security', label: 'Security Policies' },
        { id: 'terms', label: 'Terms of Service' }
      ],
      cta: {
        title: 'Submit a privacy-rights request',
        text: 'Use Contact Support and identify the request as GDPR or privacy-related.',
        label: 'Start a Privacy Request'
      }
    }
  ];

  global.GXA_CONTENT_PAGES = Object.freeze(pages.map(page => Object.freeze(page)));
})(typeof window !== 'undefined' ? window : globalThis);
