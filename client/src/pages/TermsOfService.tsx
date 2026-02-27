import { Link } from 'react-router-dom';

export default function TermsOfService() {
  return (
    <div className="min-h-screen p-4">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="text-violet-400 hover:underline text-sm mb-4 inline-block">
          &larr; Back to Home
        </Link>

        <h1 className="text-3xl font-bold text-gradient mb-6">Terms of Service</h1>

        <div className="space-y-6 text-slate-300 text-sm leading-relaxed">
          <section>
            <h2 className="text-white font-semibold text-lg mb-2">1. Acceptance of Terms</h2>
            <p>
              By using Ame, you agree to these Terms of Service. If you do not agree,
              do not use the service.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">2. Eligibility — 18+ Only</h2>
            <p>
              You must be at least <strong className="text-white">18 years old</strong> to use this
              service. By creating an account you confirm that you meet this age requirement. Users
              found to be under 18 will be permanently banned and their accounts deleted.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">3. Acceptable Use</h2>
            <p>You agree NOT to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Display or transmit sexually explicit, violent, or illegal content</li>
              <li>Harass, threaten, or abuse other users</li>
              <li>Record or screenshot other users without their explicit consent</li>
              <li>Impersonate another person or misrepresent your identity</li>
              <li>Use the service for commercial purposes or spam</li>
              <li>Attempt to circumvent bans or moderation measures</li>
              <li>Use automated tools or bots to access the service</li>
              <li>Expose, solicit, or share any content involving minors</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">4. Moderation</h2>
            <p>
              Users can report violations using the Report button during a chat. Reports are reviewed
              by our moderation team. Violations may result in temporary or permanent bans. Users who
              receive 3 or more reports within a short period will be automatically suspended pending
              review. You can also block a user at any time to prevent future matches with them.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">5. Child Safety — Zero Tolerance</h2>
            <p>
              Ame has a <strong className="text-white">zero-tolerance policy</strong> for child sexual
              abuse material (CSAM) and any content that exploits or endangers minors. Any user who
              shares, solicits, or attempts to obtain such content will be permanently banned, and the
              incident will be reported to the National Center for Missing and Exploited Children
              (NCMEC) and relevant law enforcement agencies.
            </p>
            <p className="mt-2">
              If you encounter content that may involve a minor being harmed, use the in-app Report
              button immediately and select <strong className="text-white">"Suspected Underage User"</strong>.
              This triggers a priority escalation to our moderation team.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">6. No Guarantee of Safety</h2>
            <p>
              While we take moderation seriously, we cannot guarantee the behavior of other users.
              You use this service at your own risk. If you encounter inappropriate behavior,
              use the Report button immediately and disconnect from the chat.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">7. Account Deletion</h2>
            <p>
              You may delete your account at any time from the Settings panel within the app.
              Deletion permanently removes your personal information (email, phone number, display
              name) from our systems. Session records are retained in anonymized form for safety
              and legal compliance for up to 12 months.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">8. Disclaimer</h2>
            <p>
              The service is provided "as is" without warranties of any kind. We are not liable
              for any damages arising from your use of the service, including but not limited to
              exposure to offensive content.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">9. Termination</h2>
            <p>
              We reserve the right to terminate or restrict access to the service for any user
              at any time, with or without cause.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">10. Contact</h2>
            <p>
              For support or ban appeals: <span className="text-violet-400">support@ame.app</span>.
              For data deletion or privacy inquiries: <span className="text-violet-400">privacy@ame.app</span>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
