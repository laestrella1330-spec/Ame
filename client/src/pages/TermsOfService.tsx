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
            <h2 className="text-white font-semibold text-lg mb-2">2. Eligibility</h2>
            <p>
              You must be at least 18 years old to use this service. By using the service,
              you confirm that you meet this age requirement.
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
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">4. Moderation</h2>
            <p>
              Users can report violations using the Report button. Reports are reviewed by administrators.
              Violations may result in temporary or permanent bans. Users who receive multiple reports
              may be automatically banned.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">5. No Guarantee of Safety</h2>
            <p>
              While we take moderation seriously, we cannot guarantee the behavior of other users.
              You use this service at your own risk. If you encounter inappropriate behavior,
              use the Report button immediately and disconnect from the chat.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">6. Disclaimer</h2>
            <p>
              The service is provided "as is" without warranties of any kind. We are not liable
              for any damages arising from your use of the service, including but not limited to
              exposure to offensive content.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">7. Termination</h2>
            <p>
              We reserve the right to terminate or restrict access to the service for any user
              at any time, with or without cause.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
