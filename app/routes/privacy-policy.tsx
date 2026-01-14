export default function PrivacyPolicy() {
  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "40px 20px", fontFamily: "system-ui, sans-serif" }}>
      <h1>Privacy Policy for Product Notes for Staff</h1>
      <p><strong>Last updated:</strong> January 13, 2026</p>

      <h2>1. Who We Are</h2>
      <p>
        This privacy policy explains how Select Sourcing Solutions LLC ("we", "us", or "our")
        collects, uses, and protects information in connection with the Product Notes for Staff for
        Shopify ("the App").
      </p>
      <p>
        For data processed through the App on your Shopify store, you (the merchant) are generally
        the data controller and we act as a data processor, processing data on your behalf. For
        information collected through our own website, support, or billing relationship with you,
        we may act as a data controller.
      </p>

      <h2>2. Information We Collect</h2>
      <p>We collect information you provide directly to us when using the Product Notes for Staff, including:</p>
      <ul>
        <li>Product notes and content you create</li>
        <li>Photos you upload as attachments to notes</li>
        <li>Shopify product IDs and order IDs (for associating notes)</li>
        <li>Note acknowledgment records</li>
        <li>App configuration and settings related to how the App behaves on your store</li>
        <li>Staff user identifiers and emails associated with note creation or acknowledgment (for audit purposes)</li>
        <li>Technical information such as your shop domain and session data needed to connect to your Shopify store</li>
      </ul>

      <h3>Information We Do NOT Persist</h3>
      <p>
        <strong>We do not persist customer personal information in our application database.</strong>
        The App is designed to work with Shopify resource identifiers (such as product IDs and order IDs)
        and internal notes created by your staff.
      </p>
      <p>
        Customer-identifiable data (such as customer names, email addresses, shipping addresses, and
        phone numbers) may be present in Shopify webhooks and API responses in memory or in short-lived
        application logs used for operational monitoring and debugging. However, we do not store this
        information as part of the App's core data model, and we do not use it to build independent
        customer profiles.
      </p>

      <h2>3. How We Use Your Information</h2>
      <p>We use the information we collect to:</p>
      <ul>
        <li>Provide, maintain, and improve the Product Notes for Staff and its features</li>
        <li>Store and manage your product notes, photos, and related data</li>
        <li>Generate audit logs for compliance, accountability, and training purposes</li>
        <li>Provide customer support and respond to inquiries</li>
        <li>Process billing and subscription management for the App</li>
        <li>Monitor and improve the stability, performance, and security of the App</li>
      </ul>
      <p>
        Our legal bases for processing (where applicable under GDPR) include performance of a
        contract (providing the App to you), our legitimate interests in operating and improving
        the App, and compliance with legal obligations.
      </p>

      <h2>4. Information Sharing and Disclosure</h2>
      <p>
        We do not sell, trade, or otherwise transfer your personal information to third parties except:
      </p>
      <ul>
        <li>With your explicit consent</li>
        <li>To comply with legal obligations</li>
        <li>To protect our rights and safety</li>
        <li>With service providers who assist in app functionality, as described below</li>
      </ul>

      <h3>Service Providers</h3>
      <p>We use the following categories of service providers:</p>
      <ul>
        <li><strong>Hosting:</strong> Railway (application hosting and deployment)</li>
        <li><strong>Database:</strong> PostgreSQL database hosted on Railway</li>
        <li><strong>File Storage:</strong> Railway Volume storage for photo attachments</li>
      </ul>
      <p>
        These service providers are bound by data processing agreements and only use data to provide
        their services to us. If we adopt additional monitoring or analytics tools in the future,
        we will update this policy accordingly.
      </p>

      <h3>International Data Transfers</h3>
      <p>
        Your data may be transferred to and processed in the United States or other countries where
        our service providers operate. Where required, we rely on appropriate safeguards such as
        Standard Contractual Clauses to ensure adequate protection of your data.
      </p>

      <h2>5. Data Security</h2>
      <p>
        We implement appropriate security measures to protect your information against unauthorized
        access, alteration, disclosure, or destruction. This includes encryption of data in transit
        and at rest.
      </p>

      <h2>6. Data Retention and Deletion</h2>
      <p>
        We retain your information for as long as your account is active or as needed to provide
        services.
      </p>
      <p>
        <strong>Upon app uninstallation, ALL your data is automatically deleted</strong>, including:
      </p>
      <ul>
        <li>All product notes and photo attachments</li>
        <li>All acknowledgment records</li>
        <li>All audit logs</li>
        <li>App settings and subscription metadata</li>
        <li>Session data</li>
      </ul>
      <p>
        We also respond to Shopify's GDPR webhooks (SHOP_REDACT) to ensure complete data removal
        within 48 hours of uninstallation. Note that we do not handle or store your payment card
        details—billing is processed entirely by Shopify.
      </p>

      <h2>7. Your Rights</h2>
      <p>You have the right to:</p>
      <ul>
        <li>Access your personal data</li>
        <li>Correct inaccurate data</li>
        <li>Delete your data</li>
        <li>Export your data</li>
        <li>Restrict processing of your data</li>
      </ul>
      <p>
        To exercise these rights, please contact us using the information in Section 11 below.
      </p>

      <h2>8. GDPR Compliance</h2>
      <p>
        If you are located in the European Union, you have additional rights under the General
        Data Protection Regulation (GDPR), including the right to data portability and the right
        to lodge a complaint with a supervisory authority.
      </p>

      <h2>9. Children's Privacy</h2>
      <p>
        Our service is not intended for use by children under 13 years of age. We do not knowingly
        collect personal information from children under 13.
      </p>

      <h2>10. Changes to This Policy</h2>
      <p>
        We may update this privacy policy from time to time. We will notify you of any changes by
        posting the new privacy policy on this page and updating the "Last updated" date.
      </p>

      <h2>11. Contact Us</h2>
      <p>
        If you have any questions about this privacy policy, please contact us at:
      </p>
      <ul>
        <li>Email: privacy@selectsourcingsolutions.com</li>
        <li>Select Sourcing Solutions LLC</li>
      </ul>

      <hr style={{ margin: "40px 0" }} />
      <p style={{ fontSize: "14px", color: "#666" }}>
        This privacy policy is intended to comply with applicable data protection laws, including
        GDPR and CCPA, as well as Shopify App Store requirements.
      </p>
    </div>
  );
}
