export default function DataProcessingAgreement() {
  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "40px 20px", fontFamily: "system-ui, sans-serif" }}>
      <h1>Data Processing Agreement (DPA)</h1>
      <p><strong>Last updated:</strong> {new Date().toLocaleDateString()}</p>
      
      <h2>1. Definitions</h2>
      <ul>
        <li><strong>"Controller"</strong> means the Shopify merchant using the Notey‑ Product Notes for Staff</li>
        <li><strong>"Processor"</strong> means Select Sourcing Solutions LLC</li>
        <li><strong>"Personal Data"</strong> has the meaning set forth in the GDPR</li>
        <li><strong>"Processing"</strong> has the meaning set forth in the GDPR</li>
      </ul>
      
      <h2>2. Scope and Purpose</h2>
      <p>
        This DPA governs the processing of Personal Data by the Processor on behalf of the Controller 
        in connection with the Notey‑ Product Notes for Staff. The processing is limited to the following purposes:
      </p>
      <ul>
        <li>Storing and managing product notes created by the Controller</li>
        <li>Managing photo attachments uploaded by the Controller</li>
        <li>Maintaining audit logs of user activities</li>
        <li>Providing app functionality and support services</li>
      </ul>
      
      <h2>3. Categories of Data Subjects</h2>
      <p>Personal Data processed may relate to the following categories of data subjects:</p>
      <ul>
        <li>Shopify store staff members and administrators</li>
        <li>Users who create, edit, or acknowledge product notes</li>
      </ul>
      
      <h2>4. Types of Personal Data</h2>
      <p>The following types of Personal Data may be processed:</p>
      <ul>
        <li>User identification information (email addresses, user IDs)</li>
        <li>Activity logs and timestamps</li>
        <li>Photo attachments that may contain personal information</li>
        <li>IP addresses and technical identifiers</li>
      </ul>
      
      <h2>5. Processor Obligations</h2>
      <p>The Processor agrees to:</p>
      <ul>
        <li>Process Personal Data only for the specified purposes</li>
        <li>Implement appropriate technical and organizational security measures</li>
        <li>Ensure confidentiality of processing</li>
        <li>Assist the Controller in responding to data subject requests</li>
        <li>Notify the Controller of any data breaches within 24 hours</li>
        <li>Delete or return Personal Data upon termination of services</li>
      </ul>
      
      <h2>6. Security Measures</h2>
      <p>The Processor implements the following security measures:</p>
      <ul>
        <li>Encryption of data in transit and at rest</li>
        <li>Access controls and user authentication</li>
        <li>Regular security assessments and updates</li>
        <li>Secure hosting infrastructure (Railway)</li>
        <li>Backup and disaster recovery procedures</li>
      </ul>

      <h2>7. Sub-processors</h2>
      <p>The Controller authorizes the use of the following sub-processors:</p>
      <ul>
        <li>Railway - Application hosting and PostgreSQL database</li>
        <li>Shopify Inc. - Authentication and billing services</li>
      </ul>
      
      <h2>8. Data Subject Rights</h2>
      <p>
        The Processor will assist the Controller in fulfilling data subject rights under the GDPR, 
        including:
      </p>
      <ul>
        <li>Right of access</li>
        <li>Right to rectification</li>
        <li>Right to erasure</li>
        <li>Right to restrict processing</li>
        <li>Right to data portability</li>
      </ul>
      
      <h2>9. Data Transfers</h2>
      <p>
        Personal Data may be transferred to and processed in countries outside the EEA. Such transfers 
        are protected by appropriate safeguards, including:
      </p>
      <ul>
        <li>Standard Contractual Clauses approved by the European Commission</li>
        <li>Adequacy decisions by the European Commission</li>
        <li>Other legally recognized transfer mechanisms</li>
      </ul>
      
      <h2>10. Data Breach Notification</h2>
      <p>
        In case of a personal data breach, the Processor will notify the Controller within 24 hours 
        and provide all relevant information to enable the Controller to meet its notification obligations.
      </p>
      
      <h2>11. Data Retention and Deletion</h2>
      <p>
        Personal Data will be retained only as long as necessary for the purposes outlined in this DPA. 
        Upon termination of the service agreement, all Personal Data will be deleted within 48 hours, 
        except as required by applicable law.
      </p>
      
      <h2>12. Audit and Compliance</h2>
      <p>
        The Processor will provide reasonable assistance to the Controller for compliance audits and 
        make available all information necessary to demonstrate compliance with this DPA.
      </p>
      
      <h2>13. Liability and Indemnification</h2>
      <p>
        Each party's liability under this DPA is subject to the limitations and exclusions set forth 
        in the main service agreement.
      </p>
      
      <h2>14. Term and Termination</h2>
      <p>
        This DPA remains in effect for the duration of the service agreement and will automatically 
        terminate upon termination of the service agreement.
      </p>
      
      <h2>15. Contact Information</h2>
      <p>
        For questions regarding data processing, contact our Data Protection Officer at:
      </p>
      <ul>
        <li>Email: dpo@selectsourcingsolutions.com</li>
        <li>Address: [Your Business Address]</li>
      </ul>
      
      <hr style={{ margin: "40px 0" }} />
      <p style={{ fontSize: "14px", color: "#666" }}>
        This DPA is compliant with GDPR requirements and Shopify App Store policies.
      </p>
    </div>
  );
}