import { Link } from 'react-router-dom';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen p-4">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="text-violet-400 hover:underline text-sm mb-4 inline-block">
          &larr; Back to Home
        </Link>

        <h1 className="text-3xl font-bold text-gradient mb-6">Privacy Policy</h1>

        <div className="space-y-6 text-slate-300 text-sm leading-relaxed">
          <section>
            <h2 className="text-white font-semibold text-lg mb-2">1. Information We Collect</h2>
            <p>We collect minimal information necessary to operate the service:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>IP Address:</strong> Used for ban enforcement and abuse prevention. Stored in our database.</li>
              <li><strong>Session Data:</strong> Anonymous session IDs, timestamps, and duration. No personal identifiers.</li>
              <li><strong>Reports:</strong> If you submit a report, the reason and optional description are stored.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">2. Video and Audio</h2>
            <p>
              Video and audio streams are transmitted directly between users via WebRTC (peer-to-peer).
              <strong> We do not record, store, or have access to any video or audio content.</strong>
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">3. How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To connect you with other users for video chat</li>
              <li>To enforce bans on users who violate our terms</li>
              <li>To process and review user reports</li>
              <li>To generate anonymous usage statistics</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">4. Third-Party Services</h2>
            <p>
              We use Google STUN servers to facilitate WebRTC connections. These servers help establish
              peer-to-peer connections but do not have access to your video or audio content. Your IP
              address may be visible to Google's STUN servers during the connection process.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">5. Data Retention</h2>
            <p>
              Session data is retained for analytics purposes. IP-based bans are stored until they expire
              or are manually removed. Report data is retained for moderation purposes.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">6. Your Rights</h2>
            <p>
              Since the service is anonymous, we have limited ability to identify specific user data.
              If you believe your IP has been incorrectly banned, contact the platform administrator.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">7. Cookies</h2>
            <p>
              We use session storage (not cookies) to track your consent acceptance during a browser session.
              No tracking cookies are used.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
