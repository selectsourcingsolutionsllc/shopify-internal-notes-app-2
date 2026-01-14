export default function PrivacyPolicy() {
  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "40px 20px", fontFamily: "system-ui, sans-serif" }}>
      <h1>Privacy Policy for Internal Notes App</h1>
      <p><strong>Last updated:</strong> January 13, 2026</p>
      
      <h2>1. Information We Collect</h2>
      <p>
        We collect information you provide directly to us when using the Internal Notes App, including:
      </p>
      <ul>
        <li>Product notes and content you create</li>
        <li>Photos you upload as attachments to notes</li>
        <li>Shopify product IDs and order IDs (for associating notes)</li>
        <li>Staff user IDs and emails (for audit trail purposes)</li>
        <li>Note acknowledgment records</li>
        <li>App configuration and settings</li>
      </ul>

      <h3>Information We Do NOT Collect</h3>
      <p>
        <strong>We do not store customer personal information.</strong> This app does not collect, store,
        or process customer names, email addresses, shipping addresses, phone numbers, or any other
        customer-identifiable data. We only store Shopify resource identifiers (product IDs, order IDs)
        and internal notes created by your staff.
      </p>
      
      <h2>2. How We Use Your Information</h2>
      <p>We use the information we collect to:</p>
      <ul>
        <li>Provide, maintain, and improve the Internal Notes App</li>
        <li>Store and manage your product notes and related data</li>
        <li>Generate audit logs for compliance and training purposes</li>
        <li>Provide customer support</li>
        <li>Process billing and subscription management</li>
      </ul>
      
      <h2>3. Information Sharing and Disclosure</h2>
      <p>
        We do not sell, trade, or otherwise transfer your personal information to third parties except:
      </p>
      <ul>
        <li>With your explicit consent</li>
        <li>To comply with legal obligations</li>
        <li>To protect our rights and safety</li>
        <li>With service providers who assist in app functionality (AWS, hosting providers)</li>
      </ul>
      
      <h2>4. Data Security</h2>
      <p>
        We implement appropriate security measures to protect your information against unauthorized 
        access, alteration, disclosure, or destruction. This includes encryption of data in transit 
        and at rest.
      </p>
      
      <h2>5. Data Retention and Deletion</h2>
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
        <li>App settings and billing information</li>
        <li>Session data</li>
      </ul>
      <p>
        We also respond to Shopify's GDPR webhooks (SHOP_REDACT) to ensure complete data removal
        within 48 hours of uninstallation.
      </p>
      
      <h2>6. Your Rights</h2>
      <p>You have the right to:</p>
      <ul>
        <li>Access your personal data</li>
        <li>Correct inaccurate data</li>
        <li>Delete your data</li>
        <li>Export your data</li>
        <li>Restrict processing of your data</li>
      </ul>
      
      <h2>7. GDPR Compliance</h2>
      <p>
        If you are located in the European Union, you have additional rights under the General 
        Data Protection Regulation (GDPR), including the right to data portability and the right 
        to lodge a complaint with a supervisory authority.
      </p>
      
      <h2>8. Children's Privacy</h2>
      <p>
        Our service is not intended for use by children under 13 years of age. We do not knowingly 
        collect personal information from children under 13.
      </p>
      
      <h2>9. Changes to This Policy</h2>
      <p>
        We may update this privacy policy from time to time. We will notify you of any changes by 
        posting the new privacy policy on this page and updating the "Last updated" date.
      </p>
      
      <h2>10. Contact Us</h2>
      <p>
        If you have any questions about this privacy policy, please contact us at:
      </p>
      <ul>
        <li>Email: privacy@selectsourcingsolutions.com</li>
        <li>Select Sourcing Solutions LLC</li>
      </ul>
      
      <hr style={{ margin: "40px 0" }} />
      <p style={{ fontSize: "14px", color: "#666" }}>
        This privacy policy is compliant with GDPR, CCPA, and Shopify App Store requirements.
      </p>
    </div>
  );
}