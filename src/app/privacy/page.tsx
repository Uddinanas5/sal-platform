import Link from "next/link"

export const metadata = {
  title: "Privacy Policy - SAL",
  description: "Privacy Policy for the SAL salon and wellness management platform.",
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-cream dark:bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-30 bg-cream/80 dark:bg-background/80 backdrop-blur-lg border-b border-cream-200 dark:border-border">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-foreground hover:text-sal-600 transition-colors"
          >
            <svg viewBox="0 0 32 32" className="w-7 h-7 text-sal-500" fill="currentColor">
              <path d="M16 4c-2.5 0-4.5 1.2-5.8 3.1C8.9 8.9 8 11.3 8 14c0 3.5 1.5 6.5 4 8.5V26a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-3.5c2.5-2 4-5 4-8.5 0-2.7-.9-5.1-2.2-6.9C20.5 5.2 18.5 4 16 4z" />
            </svg>
            <span className="font-heading font-semibold text-lg">SAL</span>
          </Link>
          <Link
            href="/terms"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Terms of Service
          </Link>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-12 pb-24">
        <header className="mb-10">
          <h1 className="text-3xl font-heading font-bold text-foreground">
            Privacy Policy
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Last updated: February 20, 2026
          </p>
        </header>

        <div className="space-y-8 text-sm leading-relaxed text-foreground/90">
          {/* 1. Information We Collect */}
          <section>
            <h2 className="text-lg font-heading font-semibold text-foreground mb-3">
              1. Information We Collect
            </h2>
            <p className="mb-3">
              We collect information you provide directly and information generated through your
              use of the Platform:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>
                <span className="font-medium text-foreground">Account information:</span>{" "}
                Name, email address, phone number, password, and business details when you register
              </li>
              <li>
                <span className="font-medium text-foreground">Business data:</span>{" "}
                Services, pricing, staff schedules, appointment records, products, inventory,
                and financial information you enter into the Platform
              </li>
              <li>
                <span className="font-medium text-foreground">Client data:</span>{" "}
                Information about your clients that you store in the Platform, including names,
                contact details, appointment history, preferences, and notes
              </li>
              <li>
                <span className="font-medium text-foreground">Usage data:</span>{" "}
                Information about how you interact with the Platform, including pages viewed,
                features used, browser type, device information, and IP address
              </li>
            </ul>
          </section>

          {/* 2. How We Use Information */}
          <section>
            <h2 className="text-lg font-heading font-semibold text-foreground mb-3">
              2. How We Use Information
            </h2>
            <p className="mb-3">We use the information we collect to:</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li>Provide, maintain, and improve the Platform&apos;s services</li>
              <li>Process appointments, payments, and other transactions</li>
              <li>Send appointment confirmations, reminders, and other service-related communications</li>
              <li>Provide customer support and respond to your requests</li>
              <li>Analyze usage patterns to improve the user experience</li>
              <li>Detect, prevent, and address technical issues and security threats</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          {/* 3. Data Storage & Security */}
          <section>
            <h2 className="text-lg font-heading font-semibold text-foreground mb-3">
              3. Data Storage &amp; Security
            </h2>
            <p>
              Your data is stored securely using Supabase (built on AWS infrastructure) with
              encryption at rest and in transit. We implement industry-standard security measures
              including TLS/SSL encryption for all data transfers, secure password hashing,
              database-level access controls, and regular security audits. While no method of
              transmission over the Internet is 100% secure, we strive to use commercially
              acceptable means to protect your personal information.
            </p>
          </section>

          {/* 4. Third-Party Services */}
          <section>
            <h2 className="text-lg font-heading font-semibold text-foreground mb-3">
              4. Third-Party Services
            </h2>
            <p className="mb-3">
              We use the following third-party services to operate the Platform:
            </p>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li>
                <span className="font-medium text-foreground">Vercel</span> &mdash; Application
                hosting and deployment
              </li>
              <li>
                <span className="font-medium text-foreground">Supabase</span> &mdash; Database
                hosting and authentication infrastructure
              </li>
              <li>
                <span className="font-medium text-foreground">Resend</span> &mdash; Transactional
                email delivery (appointment confirmations, reminders, etc.)
              </li>
            </ul>
            <p className="mt-3">
              These services have their own privacy policies and we encourage you to review them.
              We only share the minimum data necessary for each service to function.
            </p>
          </section>

          {/* 5. Data Retention */}
          <section>
            <h2 className="text-lg font-heading font-semibold text-foreground mb-3">
              5. Data Retention
            </h2>
            <p>
              We retain your personal information for as long as your account is active or as needed
              to provide you with our services. If you delete your account, we will delete or
              anonymize your personal data within 30 days, except where we are required to retain
              it for legal, regulatory, or legitimate business purposes (such as financial records
              required by tax law). Business data, including appointment records and transaction
              history, may be retained in anonymized form for analytics purposes.
            </p>
          </section>

          {/* 6. Your Rights */}
          <section>
            <h2 className="text-lg font-heading font-semibold text-foreground mb-3">
              6. Your Rights
            </h2>
            <p className="mb-3">You have the right to:</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li>
                <span className="font-medium text-foreground">Access</span> &mdash; Request a
                copy of the personal data we hold about you
              </li>
              <li>
                <span className="font-medium text-foreground">Correction</span> &mdash; Request
                that we correct any inaccurate or incomplete information
              </li>
              <li>
                <span className="font-medium text-foreground">Deletion</span> &mdash; Request
                that we delete your personal data, subject to certain legal obligations
              </li>
              <li>
                <span className="font-medium text-foreground">Export</span> &mdash; Request a
                portable copy of your data in a commonly used format (CSV/JSON)
              </li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, contact us at{" "}
              <a
                href="mailto:hello@salplatform.com"
                className="text-sal-600 dark:text-sal-400 underline underline-offset-2 hover:text-sal-700 dark:hover:text-sal-300 transition-colors"
              >
                hello@salplatform.com
              </a>
              . We will respond to your request within 30 days.
            </p>
          </section>

          {/* 7. Cookies */}
          <section>
            <h2 className="text-lg font-heading font-semibold text-foreground mb-3">
              7. Cookies
            </h2>
            <p>
              We use minimal cookies, limited to essential session cookies required for
              authentication and maintaining your login state. We do not use tracking cookies,
              advertising cookies, or third-party analytics cookies. Your theme preference
              (light/dark mode) is stored in your browser&apos;s local storage and is not
              transmitted to our servers.
            </p>
          </section>

          {/* 8. Children's Privacy */}
          <section>
            <h2 className="text-lg font-heading font-semibold text-foreground mb-3">
              8. Children&apos;s Privacy
            </h2>
            <p>
              The Platform is not intended for use by anyone under the age of 16. We do not
              knowingly collect personal information from children under 16. If you are a parent
              or guardian and you become aware that your child has provided us with personal
              information, please contact us. If we discover that a child under 16 has provided
              us with personal information, we will delete such information from our servers
              promptly.
            </p>
          </section>

          {/* 9. Changes to Policy */}
          <section>
            <h2 className="text-lg font-heading font-semibold text-foreground mb-3">
              9. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any
              changes by posting the new Privacy Policy on this page and updating the &ldquo;Last
              updated&rdquo; date. For material changes, we will provide additional notice via
              email or an in-app notification. You are advised to review this Privacy Policy
              periodically for any changes.
            </p>
          </section>

          {/* 10. Contact */}
          <section>
            <h2 className="text-lg font-heading font-semibold text-foreground mb-3">
              10. Contact
            </h2>
            <p>
              If you have any questions about this Privacy Policy or our data practices, please
              contact us at{" "}
              <a
                href="mailto:hello@salplatform.com"
                className="text-sal-600 dark:text-sal-400 underline underline-offset-2 hover:text-sal-700 dark:hover:text-sal-300 transition-colors"
              >
                hello@salplatform.com
              </a>
              .
            </p>
          </section>
        </div>
      </main>
    </div>
  )
}
