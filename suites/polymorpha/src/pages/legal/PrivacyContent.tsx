import { H3, LI, P, UL } from "./legalShared";

export function PrivacyContent() {
  return (
    <>
      <P>
        This Privacy Policy describes how Polymorpha ("we", "us", "the Company")
        collects, uses, stores, and protects your personal information when you
        use our Service. We are committed to protecting your privacy and
        processing your data in compliance with the General Data Protection
        Regulation (GDPR), the Australian Privacy Act 1988, the California
        Consumer Privacy Act (CCPA), and other applicable data protection
        legislation.
      </P>

      <H3>1. Data Controller</H3>
      <P>
        Polymorpha acts as the data controller for personal data collected
        through the Service. For data processing enquiries, contact our Data
        Protection contact at support@polymorpha.io.
      </P>

      <H3>2. Personal Data We Collect</H3>
      <P>We collect the following categories of personal data:</P>
      <UL>
        <LI>
          <strong>Account data:</strong> Email address, display name, and
          optional profile photograph provided during registration
        </LI>
        <LI>
          <strong>Authentication data:</strong> Hashed credentials, OAuth
          tokens, session identifiers, and login timestamps
        </LI>
        <LI>
          <strong>Usage data:</strong> Pages viewed, features accessed,
          interaction timestamps, browser type, operating system, and screen
          resolution
        </LI>
        <LI>
          <strong>Payment data:</strong> Billing name and address, last four
          digits of payment card (full card details are processed exclusively by
          Stripe and never stored on our servers)
        </LI>
        <LI>
          <strong>User-uploaded data:</strong> Files you upload for analysis,
          stored only when you explicitly enable cloud storage or when required
          for feature functionality
        </LI>
        <LI>
          <strong>Device and network data:</strong> IP address (anonymised after
          30 days), approximate geographic location at country level, device
          identifiers
        </LI>
      </UL>

      <H3>3. Legal Basis for Processing (GDPR)</H3>
      <P>We process your personal data under the following legal bases:</P>
      <UL>
        <LI>
          <strong>Contract performance:</strong> Processing necessary to provide
          the Service you have subscribed to (Article 6(1)(b))
        </LI>
        <LI>
          <strong>Legitimate interests:</strong> Analytics for service
          improvement, fraud prevention, and security monitoring (Article
          6(1)(f))
        </LI>
        <LI>
          <strong>Consent:</strong> Non-essential cookies and marketing
          communications, where applicable (Article 6(1)(a))
        </LI>
        <LI>
          <strong>Legal obligation:</strong> Where required by law, regulation,
          or valid legal process (Article 6(1)(c))
        </LI>
      </UL>

      <H3>4. How We Use Your Data</H3>
      <UL>
        <LI>To provide, operate, and maintain the Service</LI>
        <LI>To authenticate your identity and manage your account</LI>
        <LI>To process payments and enforce subscription plan limits</LI>
        <LI>
          To communicate service-critical updates, security alerts, and policy
          changes
        </LI>
        <LI>To detect and prevent fraud, abuse, and security incidents</LI>
        <LI>
          To analyse aggregated, anonymised usage patterns to improve the
          Service
        </LI>
        <LI>
          To comply with legal obligations and respond to lawful requests from
          authorities
        </LI>
      </UL>

      <H3>5. Data We Do Not Collect</H3>
      <P>
        We do not inspect, analyse, or extract information from your uploaded
        datasets for any purpose other than performing the statistical
        operations you request. We do not use your data to train machine
        learning models. We do not sell, rent, or trade your personal data to
        third parties for marketing purposes.
      </P>

      <H3>6. Third-Party Processors</H3>
      <P>
        We engage the following sub-processors, each bound by data processing
        agreements:
      </P>
      <UL>
        <LI>
          <strong>Google Firebase:</strong> Authentication, Firestore database,
          and Cloud Storage (data region: Australia / US multi-region)
        </LI>
        <LI>
          <strong>Cloudflare:</strong> CDN, DDoS protection, Workers compute,
          and DNS (global edge network)
        </LI>
        <LI>
          <strong>Stripe:</strong> Payment processing and subscription
          management (PCI DSS Level 1 certified)
        </LI>
      </UL>

      <H3>7. International Data Transfers</H3>
      <P>
        Your data may be transferred to and processed in countries outside your
        jurisdiction, including the United States and Australia. Where transfers
        occur outside the EEA/UK, we rely on Standard Contractual Clauses (SCCs)
        approved by the European Commission or adequacy decisions to ensure an
        appropriate level of data protection.
      </P>

      <H3>8. Data Retention</H3>
      <UL>
        <LI>
          <strong>Account data:</strong> Retained for the lifetime of your
          account plus 30 days after deletion
        </LI>
        <LI>
          <strong>Uploaded files:</strong> Deleted within 30 days of account
          deletion or upon your explicit request
        </LI>
        <LI>
          <strong>Usage logs:</strong> Retained for 90 days in identifiable
          form, then aggregated and anonymised
        </LI>
        <LI>
          <strong>Payment records:</strong> Retained for 7 years as required by
          tax and financial regulations
        </LI>
        <LI>
          <strong>IP addresses:</strong> Anonymised after 30 days
        </LI>
      </UL>

      <H3>9. Data Security</H3>
      <P>
        We implement appropriate technical and organisational measures to
        protect your personal data, including: encryption in transit (TLS 1.3)
        and at rest (AES-256), access controls and least-privilege principles,
        regular security assessments, and incident response procedures. While we
        strive to protect your data, no method of transmission or storage is
        100% secure.
      </P>

      <H3>10. Your Rights</H3>
      <P>Depending on your jurisdiction, you may have the following rights:</P>
      <UL>
        <LI>
          <strong>Right of access:</strong> Obtain a copy of the personal data
          we hold about you
        </LI>
        <LI>
          <strong>Right to rectification:</strong> Correct inaccurate or
          incomplete personal data
        </LI>
        <LI>
          <strong>Right to erasure:</strong> Request deletion of your personal
          data ("right to be forgotten")
        </LI>
        <LI>
          <strong>Right to data portability:</strong> Receive your data in a
          structured, machine-readable format
        </LI>
        <LI>
          <strong>Right to restrict processing:</strong> Limit how we use your
          data in certain circumstances
        </LI>
        <LI>
          <strong>Right to object:</strong> Object to processing based on
          legitimate interests
        </LI>
        <LI>
          <strong>Right to withdraw consent:</strong> Where processing is based
          on consent, withdraw at any time
        </LI>
        <LI>
          <strong>Right to lodge a complaint:</strong> File a complaint with
          your local supervisory authority
        </LI>
      </UL>
      <P>
        To exercise any of these rights, contact us at support@polymorpha.io. We
        will respond within 30 days (or the timeframe required by applicable
        law).
      </P>

      <H3>11. Children's Privacy</H3>
      <P>
        The Service is not directed at children under 16 years of age. We do not
        knowingly collect personal data from children under 16. If we become
        aware that we have collected data from a child under 16 without parental
        consent, we will take steps to delete such data promptly.
      </P>

      <H3>12. Changes to This Policy</H3>
      <P>
        We may update this Privacy Policy from time to time. Material changes
        will be notified via email or a prominent in-app notice at least 14 days
        before taking effect. The "Last updated" date at the top of this page
        reflects the most recent revision.
      </P>

      <H3>13. Contact</H3>
      <P>
        For all privacy-related enquiries, data subject requests, or to report a
        concern:
      </P>
      <P>
        <strong>Email:</strong> support@polymorpha.io
      </P>
    </>
  );
}
