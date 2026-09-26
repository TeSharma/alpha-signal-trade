import { LegalDocument, type LegalSection } from '@/components/legal/LegalDocument'

const sections: LegalSection[] = [
  {
    heading: '1. Information We Collect',
    blocks: [
      'Depending on how you use ShTrader, we may collect the following categories of information.',
      { subheading: '1.1 Account Information' },
      'When you create an account, we may collect information such as:',
      {
        list: [
          'name;',
          'email address;',
          'username;',
          'authentication information;',
          'account preferences; and',
          'other information you voluntarily provide.',
        ],
      },
      { subheading: '1.2 Wallet and Blockchain Information' },
      'If you use blockchain functionality, we may process information associated with your blockchain wallet, including:',
      {
        list: [
          'public wallet address;',
          'blockchain network;',
          'transaction hash;',
          'transaction status;',
          'token balances or transaction-related information; and',
          'publicly available blockchain transaction data.',
        ],
      },
      'Blockchain networks are generally public. Transactions recorded on a public blockchain may remain publicly accessible and may not be capable of being deleted or modified.',
      'ShTrader does not request or store your private keys or wallet recovery phrases.',
      { subheading: '1.3 Trading Information' },
      'Depending on the features you use, we may process information such as:',
      {
        list: [
          'trading activity;',
          'positions;',
          'orders;',
          'transaction history;',
          'risk-management settings;',
          'selected trading instruments;',
          'account balances;',
          'demo-account activity;',
          'preferences; and',
          'other information necessary to provide trading functionality.',
        ],
      },
      { subheading: '1.4 AI and User Inputs' },
      "If you use ShTrader's AI features, we may process information that you submit to the AI system, such as:",
      {
        list: [
          'questions;',
          'trading-related prompts;',
          'analysis requests;',
          'selected markets;',
          'risk-management information; and',
          'other information necessary to generate requested outputs.',
        ],
      },
      'Please do not submit private keys, wallet recovery phrases, passwords, or other highly sensitive credentials into AI prompts.',
      { subheading: '1.5 TikTok Information' },
      "If you connect your TikTok account to ShTrader, we may process information made available to us through TikTok's authorized APIs and your granted permissions.",
      'Depending on the permissions approved for our application, this may include information necessary to:',
      {
        list: [
          'authenticate your TikTok account;',
          'establish an authorized connection between your TikTok account and ShTrader;',
          'upload content to TikTok at your request; and',
          'manage the authorization required for the integration.',
        ],
      },
      'We only request the permissions necessary for the TikTok functionality we provide.',
      'You can revoke access to ShTrader through the applicable TikTok account controls.',
      { subheading: '1.6 Technical Information' },
      'When you access ShTrader, we may automatically collect technical information such as:',
      {
        list: [
          'IP address;',
          'browser type;',
          'device type;',
          'operating system;',
          'pages visited;',
          'referring pages;',
          'approximate location derived from technical information;',
          'timestamps;',
          'error information; and',
          'security and diagnostic logs.',
        ],
      },
      { subheading: '1.7 Cookies and Similar Technologies' },
      'We may use cookies, local storage, and similar technologies to:',
      {
        list: [
          'keep you signed in;',
          'maintain security;',
          'remember preferences;',
          'understand how the Service is used;',
          'improve performance; and',
          'measure website activity.',
        ],
      },
      'Where required by applicable law, we will request consent for non-essential cookies or similar technologies.',
    ],
  },
  {
    heading: '2. How We Use Your Information',
    blocks: [
      'We may use information to:',
      {
        list: [
          'provide and operate ShTrader;',
          'create and manage user accounts;',
          'provide trading and educational tools;',
          'provide AI-assisted analysis;',
          'calculate risk-management information;',
          'facilitate blockchain transactions initiated by users;',
          'provide customer support;',
          'connect ShTrader with TikTok when authorized by you;',
          'upload content to TikTok at your request;',
          'maintain security;',
          'detect fraud and abuse;',
          'troubleshoot technical problems;',
          'improve the Service;',
          'communicate with users about the Service;',
          'comply with legal obligations; and',
          'enforce our Terms of Service.',
        ],
      },
    ],
  },
  {
    heading: '3. Lawful Bases for Processing',
    blocks: [
      'Where applicable, we process personal information on one or more lawful bases, including:',
      {
        list: [
          'performance of a contract;',
          'compliance with legal obligations;',
          'your consent;',
          'legitimate interests, where permitted by law; and',
          'other lawful bases recognized by applicable data-protection law.',
        ],
      },
      'The Nigeria Data Protection Act 2023 establishes requirements for lawful, fair, transparent, purpose-limited, and secure processing of personal data.',
    ],
  },
  {
    heading: '4. How We Share Information',
    blocks: [
      'We may share information with service providers that help us operate ShTrader, including providers of:',
      {
        list: [
          'cloud infrastructure;',
          'databases;',
          'authentication;',
          'analytics;',
          'security;',
          'customer support;',
          'blockchain infrastructure;',
          'market-data services;',
          'AI services; and',
          'social-media/API integrations.',
        ],
      },
      'We may also disclose information where required by law, legal process, or a valid governmental request.',
      'We do not sell your personal information merely because you use ShTrader.',
    ],
  },
  {
    heading: '5. TikTok Integration',
    blocks: [
      'When you authorize ShTrader to connect with TikTok, information may be transmitted to TikTok as necessary to provide the functionality you requested.',
      "For example, if you use ShTrader's TikTok content-upload functionality, ShTrader may transmit the content and authorization information required to upload that content through TikTok's APIs.",
      "Your use of TikTok is also governed by TikTok's own privacy and terms policies.",
      'ShTrader does not control how TikTok processes information after it is transmitted to TikTok.',
    ],
  },
  {
    heading: '6. Blockchain Transparency',
    blocks: [
      'Some ShTrader functionality interacts with public blockchain networks.',
      'Blockchain transactions may permanently record information such as wallet addresses, transaction amounts, transaction timestamps, transaction hashes, and other transaction metadata.',
      'Because public blockchain data may be replicated across independent network participants, we may not be able to delete information that has already been recorded on a blockchain.',
    ],
  },
  {
    heading: '7. Data Retention',
    blocks: [
      'We retain personal information only for as long as reasonably necessary for the purposes described in this Privacy Policy, including to:',
      {
        list: [
          'provide the Service;',
          'maintain account records;',
          'comply with legal obligations;',
          'resolve disputes;',
          'enforce agreements;',
          'maintain security; and',
          'prevent fraud and abuse.',
        ],
      },
      'Retention periods may vary depending on the type of information and the purpose for which it was collected.',
      'Information recorded on public blockchains may have substantially different retention characteristics because blockchain records are generally immutable.',
    ],
  },
  {
    heading: '8. Data Security',
    blocks: [
      'We use reasonable technical and organizational safeguards designed to protect personal information against unauthorized access, loss, misuse, alteration, or disclosure.',
      'However, no internet service, computer system, or blockchain network can be guaranteed to be completely secure.',
      'You are responsible for protecting your account credentials, wallet credentials, private keys, and recovery phrases.',
    ],
  },
  {
    heading: '9. International Data Transfers',
    blocks: [
      'Some of our service providers may process information in countries other than the country in which you live.',
      'Where applicable, we will take reasonable steps required by applicable data-protection laws when transferring personal information across borders.',
      'The Nigeria Data Protection Commission recognizes specific requirements concerning cross-border transfers of personal data.',
    ],
  },
  {
    heading: '10. Your Privacy Rights',
    blocks: [
      'Depending on applicable law, you may have rights including:',
      {
        list: [
          'the right to be informed about processing;',
          'the right to access your personal information;',
          'the right to request correction of inaccurate information;',
          'the right to request deletion or erasure;',
          'the right to restrict processing;',
          'the right to object to certain processing;',
          'the right to data portability;',
          'the right to withdraw consent where processing relies on consent; and',
          'rights relating to automated decision-making, where applicable.',
        ],
      },
      'The Nigeria Data Protection Commission recognizes these categories of data-subject rights under the Nigeria Data Protection Act.',
      'Some rights may be subject to legal limitations.',
    ],
  },
  {
    heading: '11. Automated Decision-Making and AI',
    blocks: [
      'ShTrader may use automated systems and artificial intelligence to generate analysis, recommendations, classifications, calculations, or other outputs.',
      'AI-generated outputs are not guaranteed to be accurate and should not be treated as a substitute for independent judgment.',
      'Where applicable data-protection law gives you rights regarding solely automated decisions that produce legal or similarly significant effects, you may contact us to exercise those rights.',
    ],
  },
  {
    heading: '12. Account Deletion',
    blocks: [
      'You may request deletion of your ShTrader account and associated personal information by contacting:',
      'Email: support@shtrader.app',
      'Some information may need to be retained where required by law, necessary to establish or defend legal claims, required for security, or otherwise permitted by applicable law.',
      'Information already recorded on a public blockchain generally cannot be deleted by ShTrader.',
    ],
  },
  {
    heading: '13. TikTok Authorization and Revocation',
    blocks: [
      'If you authorize ShTrader to access your TikTok account, you may revoke that authorization through the applicable TikTok account settings.',
      'After revocation, ShTrader will no longer be able to use the revoked authorization to access the corresponding TikTok functionality.',
      'Revocation does not necessarily delete information that was already processed or transmitted before authorization was revoked.',
    ],
  },
  {
    heading: "14. Children's Privacy",
    blocks: [
      'ShTrader is not intended for children who are below the minimum age required to lawfully use the Service in their jurisdiction.',
      'We do not knowingly collect personal information from children in violation of applicable law.',
      'If you believe a child has provided personal information to ShTrader, contact us at:',
      'Email: support@shtrader.app',
    ],
  },
  {
    heading: '15. Third-Party Websites and Services',
    blocks: [
      'ShTrader may contain links to third-party websites or services.',
      'We are not responsible for the privacy practices, security, content, or policies of third-party services.',
      'You should review the privacy policies of third-party services before providing them with personal information.',
    ],
  },
  {
    heading: '16. Changes to This Privacy Policy',
    blocks: [
      'We may update this Privacy Policy from time to time.',
      'When we make material changes, we may update the "Last Updated" date and provide additional notice where appropriate.',
      'We encourage you to review this page periodically.',
    ],
  },
  {
    heading: '17. Contact Us',
    blocks: [
      'For privacy questions, data-access requests, deletion requests, or other privacy concerns, contact:',
      'ShTrader',
      'Email: support@shtrader.app',
      'Website: https://shtrader.app',
    ],
  },
]

const Privacy = () => (
  <LegalDocument
    title="Privacy Policy"
    lastUpdated="September 19, 2026"
    metaDescription="ShTrader Privacy Policy: the information we collect, how we use and share it, lawful bases under the Nigeria Data Protection Act 2023, your privacy rights, and how to contact us."
    intro={[
      'ShTrader ("ShTrader", "we", "us", or "our") respects your privacy and is committed to protecting personal information that we process through our website, applications, trading platform, educational services, AI features, and related services (collectively, the "Service").',
      'This Privacy Policy explains what information we collect, why we collect it, how we use it, when we share it, and the choices available to you.',
    ]}
    sections={sections}
    otherDocument={{ label: 'Read our Terms of Service', to: '/terms' }}
  />
)

export default Privacy
