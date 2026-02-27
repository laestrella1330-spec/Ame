import { Link } from 'react-router-dom';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen p-4">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="text-violet-400 hover:underline text-sm mb-4 inline-block">
          &larr; Back to Home
        </Link>

        <h1 className="text-3xl font-bold text-gradient mb-6">Privacy Policy</h1>
        <p className="text-slate-400 text-xs mb-6">Last updated: February 2025</p>

        <div className="space-y-6 text-slate-300 text-sm leading-relaxed">

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">1. Information We Collect</h2>
            <p className="mb-3">When you create an account or use Ame, we collect the following categories of data:</p>

            <h3 className="text-violet-300 font-semibold mb-1">Account Information (provided by you)</h3>
            <ul className="list-disc pl-5 mb-3 space-y-1">
              <li><strong className="text-white">Email address</strong> — if you register with email/password</li>
              <li><strong className="text-white">Phone number</strong> — if you register with phone</li>
              <li><strong className="text-white">Facebook ID</strong> — if you register via Facebook OAuth</li>
              <li><strong className="text-white">Display name</strong> — the name shown to other users</li>
              <li><strong className="text-white">Date of birth</strong> — used to verify you are 18 or older. Not shared with other users.</li>
            </ul>

            <h3 className="text-violet-300 font-semibold mb-1">Automatically Collected Data</h3>
            <ul className="list-disc pl-5 mb-3 space-y-1">
              <li><strong className="text-white">IP address</strong> — collected on login and during sessions for ban enforcement and abuse prevention</li>
              <li><strong className="text-white">Session records</strong> — start time, end time, partner ID (anonymized), and skip/report events. No video or audio content.</li>
              <li><strong className="text-white">Audit logs</strong> — account actions (login, registration, deletion) with timestamps and IP addresses, retained for security and legal compliance</li>
              <li><strong className="text-white">Reports and bans</strong> — reason, description, and outcome of any report or ban associated with your account</li>
              <li><strong className="text-white">Block list</strong> — the list of user IDs you have blocked</li>
            </ul>

            <h3 className="text-violet-300 font-semibold mb-1">Device &amp; Technical Data</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Browser type and version (via HTTP headers)</li>
              <li>Operating system (via HTTP headers)</li>
              <li>App version (Android/iOS builds)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">2. Camera &amp; Microphone</h2>
            <p className="mb-2">
              Ame requests access to your camera and microphone solely to enable live video chat. Here is exactly
              what happens with your media:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Video and audio streams are transmitted <strong className="text-white">directly between you and your chat partner</strong> using WebRTC peer-to-peer technology.</li>
              <li><strong className="text-white">We do not record, intercept, or store any video or audio content.</strong> Streams never pass through our servers.</li>
              <li>You can mute your microphone or disable your camera at any time using the in-chat controls.</li>
              <li>You may use Ame in text-only mode if you choose not to share video.</li>
              <li>Camera and microphone access is requested at the start of each session and is never used in the background.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">3. WebRTC &amp; IP Address Exposure</h2>
            <p className="mb-2">
              WebRTC peer-to-peer connections may expose your <strong className="text-white">real IP address</strong> to
              your chat partner. This is a technical characteristic of P2P communication.
            </p>
            <p>
              We use Google STUN servers (<code className="text-violet-300">stun.l.google.com</code>) to help
              establish connections. Google may log connection metadata in accordance with their own privacy policy.
              To protect your IP address from exposure to chat partners, we recommend using a VPN. We are working
              on deploying TURN relay servers that will mask peer IPs — this feature will be noted here when available.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">4. How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To authenticate you and maintain your account</li>
              <li>To verify you meet the minimum age requirement (18+)</li>
              <li>To match you with other available users for video or text chat</li>
              <li>To enforce bans, blocks, and moderation decisions</li>
              <li>To process and review reports of policy violations</li>
              <li>To comply with legal obligations, including reporting child safety violations to NCMEC and law enforcement</li>
              <li>To generate anonymous, aggregated usage statistics for service improvement</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">5. Legal Basis for Processing (GDPR)</h2>
            <p className="mb-2">If you are in the European Economic Area (EEA) or United Kingdom, we process your data under the following legal bases:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-white">Contractual necessity</strong> — account registration data (email, display name, DOB) is required to provide the service</li>
              <li><strong className="text-white">Legitimate interests</strong> — IP logging, session records, and audit logs for security and abuse prevention</li>
              <li><strong className="text-white">Legal obligation</strong> — retaining data required by law, including CSAM-related reports and associated session records</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">6. Data Retention</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-white">Account data</strong> (email, phone, display name, DOB) — retained while your account is active. Permanently deleted when you delete your account (see Section 7).</li>
              <li><strong className="text-white">Session records</strong> — retained in anonymized form for up to <strong className="text-white">12 months</strong> after a session ends, then automatically purged.</li>
              <li><strong className="text-white">Audit logs</strong> — retained for up to <strong className="text-white">12 months</strong> for security and legal compliance.</li>
              <li><strong className="text-white">Reports and bans</strong> — retained for the duration of the ban and for up to <strong className="text-white">12 months</strong> after its expiry for appeal purposes.</li>
              <li><strong className="text-white">CSAM-related records</strong> — retained indefinitely as required by applicable law and to support law enforcement investigations.</li>
              <li><strong className="text-white">IP addresses</strong> — retained in ban and audit records per the timelines above.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">7. Account Deletion</h2>
            <p className="mb-2">
              You may delete your account at any time from the <strong className="text-white">Settings</strong> panel
              within the app. When you delete your account:
            </p>
            <ul className="list-disc pl-5 mb-2 space-y-1">
              <li>Your email address, phone number, display name, date of birth, and password are <strong className="text-white">permanently erased</strong> from our systems immediately.</li>
              <li>Your account is deactivated and you are signed out of all active sessions.</li>
              <li>Your block list is deleted.</li>
            </ul>
            <p>
              Session records, audit logs, and reports involving your account are retained in
              <strong className="text-white"> anonymized form</strong> (your user ID is replaced with an irreversible token)
              for the periods described in Section 6. This anonymized data cannot be re-linked to you.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">8. Child Safety &amp; CSAM Reporting</h2>
            <p>
              Ame operates a zero-tolerance policy for child sexual abuse material (CSAM) and any content that
              exploits or endangers minors. When a report involves suspected CSAM or an underage user, relevant
              session metadata and report details are preserved and submitted to the
              <strong className="text-white"> National Center for Missing and Exploited Children (NCMEC)</strong> and
              relevant law enforcement agencies, as required by U.S. federal law (18 U.S.C. § 2258A).
              This preservation and reporting is a legal obligation and cannot be withdrawn by an account deletion request.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">9. Data Sharing</h2>
            <p className="mb-2">We do not sell your personal data. We share data only in these limited circumstances:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-white">Law enforcement</strong> — when required by valid legal process or court order</li>
              <li><strong className="text-white">NCMEC</strong> — CSAM-related reports as required by law (see Section 8)</li>
              <li><strong className="text-white">Infrastructure providers</strong> — our hosting provider (Render) and database services process data on our behalf under data processing agreements</li>
              <li><strong className="text-white">Google STUN</strong> — connection metadata only, no personal account data (see Section 3)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">10. Your Rights</h2>
            <p className="mb-2">Depending on your jurisdiction, you may have the following rights regarding your personal data:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-white">Access</strong> — request a copy of the personal data we hold about you</li>
              <li><strong className="text-white">Rectification</strong> — correct inaccurate data (e.g., display name)</li>
              <li><strong className="text-white">Erasure</strong> — delete your account and personal data (see Section 7)</li>
              <li><strong className="text-white">Portability</strong> — receive your data in a structured, machine-readable format</li>
              <li><strong className="text-white">Objection / Restriction</strong> — object to or restrict certain processing activities</li>
            </ul>
            <p className="mt-2">
              To exercise any of these rights, contact us at{' '}
              <span className="text-violet-400">privacy@ame.app</span>.
              We will respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">11. Local Storage &amp; Session Storage</h2>
            <p>
              We use your device's <strong className="text-white">localStorage</strong> to store your authentication
              token, age verification flag, and camera rationale acknowledgement. We do not use tracking cookies or
              third-party analytics SDKs. No data stored in localStorage is transmitted to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">12. Security</h2>
            <p>
              Account passwords are hashed using bcrypt and never stored in plaintext. API communications are
              encrypted in transit via HTTPS/TLS. Access to user data is restricted to authenticated administrators.
              Despite these measures, no system is perfectly secure — use a strong, unique password and do not share
              your account credentials.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">13. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. When we do, we will update the "Last updated"
              date at the top of this page. Continued use of the service after changes take effect constitutes
              acceptance of the revised policy.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">14. Contact</h2>
            <p>
              For privacy inquiries, data access requests, or account deletion assistance:{' '}
              <span className="text-violet-400">privacy@ame.app</span>
            </p>
            <p className="mt-1">
              For general support or ban appeals:{' '}
              <span className="text-violet-400">support@ame.app</span>
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
