// HUMAN_INPUT_NEEDED: lawyer review required. Section 6 (Payment Terms) below
// describes SAL's real pricing and refund/cancellation policy ($1,500 one-time
// setup + $497/month), and Section 7 (Payments, Chargebacks & Disputes)
// describes the merchant-liability chargeback policy (the shop bears lost
// chargebacks; $15 dispute fee refunded on win, waived during beta). Both are
// good-faith drafts modeled on industry-standard clauses and are NOT legal
// advice — have counsel review before relying on or enforcing them.
import Link from "next/link"

export const metadata = {
  title: "Terms of Service - SAL",
  description: "Terms of Service for the SAL salon and wellness management platform.",
}

export default function TermsPage() {
  return (
    <div className="min-h-screen env-canvas-lite">
      {/* Nav */}
      <nav className="sticky top-0 z-30 bg-[#08251a]/95 border-b border-white/10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-foreground hover:text-mint transition-colors"
          >
            <svg viewBox="0 0 32 32" className="w-7 h-7 text-mint-strong" fill="currentColor">
              <path d="M16 4c-2.5 0-4.5 1.2-5.8 3.1C8.9 8.9 8 11.3 8 14c0 3.5 1.5 6.5 4 8.5V26a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-3.5c2.5-2 4-5 4-8.5 0-2.7-.9-5.1-2.2-6.9C20.5 5.2 18.5 4 16 4z" />
            </svg>
            <span className="font-heading font-semibold text-lg">SAL</span>
          </Link>
          <Link
            href="/privacy"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Privacy Policy
          </Link>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12 pb-24">
        <div className="glass-panel glass-panel-lite rounded-panel p-6 sm:p-10">
        <header className="mb-10">
          <h1 className="text-3xl font-heading font-bold text-ink">
            Terms of Service
          </h1>
          <p className="text-sm text-ink-faint mt-2">
            Last updated: June 11, 2026
          </p>
        </header>

        <div className="space-y-8 text-sm leading-relaxed text-ink-soft">
          {/* 1. Acceptance of Terms */}
          <section>
            <h2 className="text-lg font-heading font-semibold text-foreground mb-3">
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing or using SAL (&ldquo;the Platform&rdquo;), you agree to be bound by
              these Terms of Service. If you do not agree to all of the terms and conditions
              stated here, you may not access or use the Platform. These terms apply to all
              visitors, users, and others who access or use the Platform.
            </p>
          </section>

          {/* 2. Description of Service */}
          <section>
            <h2 className="text-lg font-heading font-semibold text-foreground mb-3">
              2. Description of Service
            </h2>
            <p>
              SAL is a salon and spa management platform that provides tools for appointment
              scheduling, client management, point-of-sale, staff management, inventory tracking,
              marketing, and business analytics. The Platform is designed for salon owners,
              spa managers, and wellness professionals to streamline their daily operations and
              deliver better client experiences.
            </p>
          </section>

          {/* 3. User Accounts */}
          <section>
            <h2 className="text-lg font-heading font-semibold text-foreground mb-3">
              3. User Accounts
            </h2>
            <p className="mb-3">
              To use certain features of the Platform, you must register for an account. When you
              register, you agree to:
            </p>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li>Provide accurate, current, and complete information during registration</li>
              <li>Maintain and promptly update your account information</li>
              <li>Keep your password secure and confidential</li>
              <li>Accept responsibility for all activities that occur under your account</li>
              <li>Notify us immediately of any unauthorized access to your account</li>
            </ul>
            <p className="mt-3">
              You must be at least 16 years old to create an account. We reserve the right to
              suspend or terminate accounts that violate these terms.
            </p>
          </section>

          {/* 4. Acceptable Use */}
          <section>
            <h2 className="text-lg font-heading font-semibold text-foreground mb-3">
              4. Acceptable Use
            </h2>
            <p className="mb-3">You agree not to use the Platform to:</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe upon the rights of others, including intellectual property rights</li>
              <li>Transmit harmful, threatening, abusive, or otherwise objectionable content</li>
              <li>Attempt to gain unauthorized access to other accounts, systems, or networks</li>
              <li>Interfere with or disrupt the Platform&apos;s infrastructure or services</li>
              <li>Scrape, crawl, or collect data from the Platform without authorization</li>
              <li>Use the Platform for any fraudulent or deceptive purpose</li>
            </ul>
          </section>

          {/* 5. Intellectual Property */}
          <section>
            <h2 className="text-lg font-heading font-semibold text-foreground mb-3">
              5. Intellectual Property
            </h2>
            <p>
              The Platform and its original content, features, and functionality are owned by SAL
              and are protected by international copyright, trademark, patent, trade secret, and
              other intellectual property laws. You retain ownership of all data and content you
              upload to the Platform. By uploading content, you grant us a limited license to
              store, process, and display that content solely for the purpose of providing the
              Platform&apos;s services to you.
            </p>
          </section>

          {/* 6. Payment Terms */}
          <section>
            <h2 className="text-lg font-heading font-semibold text-foreground mb-3">
              6. Payment Terms
            </h2>
            <p>
              SAL is offered as a paid subscription: a one-time setup fee of $1,500 USD
              plus a recurring subscription of $497 USD per month. The setup fee is
              charged once at the start of your subscription; the monthly fee recurs each
              billing period until you cancel.
            </p>
            <p className="mt-3">
              You may cancel at any time through the billing portal. Cancellation takes
              effect at the end of your current billing period — you retain access until
              then. Fees already paid, including the one-time setup fee and any partial
              month, are non-refundable and not prorated, consistent with standard SaaS
              practice.
            </p>
            <p className="mt-3">
              We will provide at least 30 days&apos; notice before any change to the
              subscription price takes effect for your account. Selected beta salons may
              have billing waived at SAL&apos;s discretion; if your account is marked
              billing-exempt, no charges apply for as long as that status remains in
              effect.
            </p>
          </section>

          {/* 7. Payments, Chargebacks & Disputes */}
          <section>
            <h2 className="text-lg font-heading font-semibold text-foreground mb-3">
              7. Payments, Chargebacks &amp; Disputes
            </h2>
            <p>
              SAL Payments lets your business accept card payments from your clients,
              processed by Stripe. Payments your clients make through the Platform are
              payments to <em>your business</em> — SAL facilitates the processing but is
              not a party to the sale between you and your client.
            </p>
            <p className="mt-3">
              <strong className="text-foreground">Your business is responsible for
              chargebacks.</strong> If a client disputes (charges back) a payment made to
              your business through the Platform and the dispute is lost, your business
              bears the disputed amount. SAL may recover that amount by deducting it from
              your future payouts or by reversing the corresponding transfer to your
              connected payment account. This is standard practice across salon and
              booking platforms.
            </p>
            <p className="mt-3">
              Each dispute carries a <strong className="text-foreground">$15 USD dispute
              fee</strong>. The fee is refunded to you if you win the dispute.{" "}
              <strong className="text-foreground">During the beta period this fee is
              waived.</strong>
            </p>
            <p className="mt-3">
              When a dispute is opened, we will notify you on your dashboard and help you
              respond. You must submit any evidence (receipts, appointment records,
              cancellation-policy consent, communications) by the deadline shown —
              disputes that receive no response are almost always lost. You agree to
              cooperate in good faith with evidence requests and to maintain accurate
              records of the services you provide.
            </p>
          </section>

          {/* 8. Data & Privacy */}
          <section>
            <h2 className="text-lg font-heading font-semibold text-foreground mb-3">
              8. Data &amp; Privacy
            </h2>
            <p>
              Your use of the Platform is also governed by our{" "}
              <Link
                href="/privacy"
                className="text-mint underline underline-offset-2 hover:text-mint-soft transition-colors"
              >
                Privacy Policy
              </Link>
              , which describes how we collect, use, store, and protect your information. By using
              the Platform, you consent to the data practices described in our Privacy Policy.
            </p>
          </section>

          {/* 9. Termination */}
          <section>
            <h2 className="text-lg font-heading font-semibold text-foreground mb-3">
              9. Termination
            </h2>
            <p>
              We may terminate or suspend your account immediately, without prior notice or
              liability, for any reason, including if you breach these Terms. Upon termination,
              your right to use the Platform will cease immediately. You may also delete your
              account at any time through the Platform settings. Upon account deletion, we will
              remove your personal data in accordance with our Privacy Policy, though we may
              retain certain data as required by law or for legitimate business purposes.
            </p>
          </section>

          {/* 10. Limitation of Liability */}
          <section>
            <h2 className="text-lg font-heading font-semibold text-foreground mb-3">
              10. Limitation of Liability
            </h2>
            <p>
              To the maximum extent permitted by applicable law, SAL and its affiliates, officers,
              directors, employees, and agents shall not be liable for any indirect, incidental,
              special, consequential, or punitive damages, including but not limited to loss of
              profits, data, use, or goodwill, arising out of or in connection with your access to
              or use of (or inability to access or use) the Platform. The Platform is provided on
              an &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo; basis, without warranties of
              any kind, either express or implied.
            </p>
          </section>

          {/* 11. Changes to Terms */}
          <section>
            <h2 className="text-lg font-heading font-semibold text-foreground mb-3">
              11. Changes to Terms
            </h2>
            <p>
              We reserve the right to modify or replace these Terms at any time. If a revision is
              material, we will provide at least 30 days&apos; notice prior to the new terms taking
              effect. What constitutes a material change will be determined at our sole discretion.
              By continuing to access or use the Platform after any revisions become effective, you
              agree to be bound by the revised terms.
            </p>
          </section>

          {/* 12. Contact Information */}
          <section>
            <h2 className="text-lg font-heading font-semibold text-foreground mb-3">
              12. Contact Information
            </h2>
            <p>
              If you have any questions about these Terms, please contact us at{" "}
              <a
                href="mailto:hello@salplatform.com"
                className="text-mint underline underline-offset-2 hover:text-mint-soft transition-colors"
              >
                hello@salplatform.com
              </a>
              .
            </p>
          </section>
        </div>
        </div>
      </main>
    </div>
  )
}
