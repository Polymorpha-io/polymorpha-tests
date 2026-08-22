import { H3, LI, P, UL } from "./legalShared";

export function CookiesContent() {
  return (
    <>
      <P>
        This Cookie Policy explains how Polymorpha uses cookies and similar
        tracking technologies when you visit or interact with our Service. It
        should be read alongside our Privacy Policy.
      </P>

      <H3>1. What Are Cookies</H3>
      <P>
        Cookies are small text files placed on your device by your web browser.
        They allow websites to recognise your device, maintain session state,
        and store preferences. Similar technologies include local storage,
        session storage, and pixel tags.
      </P>

      <H3>2. Strictly Necessary Cookies</H3>
      <P>
        These cookies are essential for the Service to function and cannot be
        disabled. They do not require consent under applicable law:
      </P>
      <UL>
        <LI>
          <strong>Authentication session:</strong> Maintains your signed-in
          state across page navigations. Expires when the browser session ends
          or after 14 days of inactivity.
        </LI>
        <LI>
          <strong>CSRF protection:</strong> Prevents cross-site request forgery
          attacks. Session-scoped.
        </LI>
        <LI>
          <strong>Theme preference:</strong> Stores your selected
          light/dark/system theme. Persistent, stored in local storage.
        </LI>
        <LI>
          <strong>Cookie consent state:</strong> Records whether you have
          accepted or rejected optional cookies. Persistent for 12 months.
        </LI>
      </UL>

      <H3>3. Functional Cookies</H3>
      <P>
        These cookies enhance your experience by remembering choices you make
        (e.g., preferred export format, last-used chart type). They do not track
        you across other websites. Set only with your consent.
      </P>

      <H3>4. Analytics Cookies</H3>
      <P>
        We may use privacy-respecting, first-party analytics to understand
        aggregate usage patterns such as which features are most popular and
        where users encounter errors. Analytics data is anonymised and
        aggregated. No personally identifiable information is transmitted to
        third-party analytics services. These cookies are set only with your
        explicit consent.
      </P>

      <H3>5. Third-Party Cookies</H3>
      <P>
        The following third-party services may set cookies when you use the
        Service:
      </P>
      <UL>
        <LI>
          <strong>Firebase Authentication (Google):</strong> Sets cookies and
          local storage entries to manage authentication tokens and session
          persistence.
        </LI>
        <LI>
          <strong>Cloudflare:</strong> May set the __cf_bm cookie for bot
          management and the cf_clearance cookie after a security challenge.
          These are necessary for security and cannot be disabled.
        </LI>
        <LI>
          <strong>Stripe:</strong> Sets cookies on payment pages for fraud
          detection. Only present during checkout flows.
        </LI>
      </UL>

      <H3>6. Managing Cookies</H3>
      <P>
        You can manage your cookie preferences at any time through: (a) the
        cookie consent banner that appears on first visit; (b) your browser's
        cookie settings; or (c) by clearing browser data. Note that disabling
        strictly necessary cookies may prevent authentication and render the
        Service unusable. Most browsers allow you to block or delete cookies —
        refer to your browser's help documentation for specific instructions.
      </P>

      <H3>7. Do Not Track</H3>
      <P>
        We honour Do Not Track (DNT) signals. When a DNT signal is detected, we
        disable all non-essential tracking.
      </P>

      <H3>8. Changes</H3>
      <P>
        We may update this Cookie Policy to reflect changes in our practices or
        applicable law. Changes take effect upon posting. Continued use of the
        Service after changes constitutes acceptance.
      </P>
    </>
  );
}
