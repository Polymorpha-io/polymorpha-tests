import { H3, LI, P, UL } from "./legalShared";

export function RefundsContent() {
  return (
    <>
      <P>
        This policy describes how billing, cancellation, refunds, and plan
        changes work for paid Polymorpha subscriptions.
      </P>

      <H3>1. Subscription Billing</H3>
      <P>
        Paid subscriptions are billed in advance on a recurring basis (monthly
        or annually, depending on your selected plan). Payment is processed
        through Stripe. By subscribing, you authorise us to charge your payment
        method at the beginning of each billing cycle. All amounts are in USD
        unless otherwise stated.
      </P>

      <H3>2. Auto-Renewal</H3>
      <P>
        Subscriptions automatically renew at the end of each billing period
        unless you cancel before the renewal date. You will not receive a
        separate renewal notice; the subscription start confirmation serves as
        acknowledgement of the recurring nature of charges.
      </P>

      <H3>3. Cancellation</H3>
      <P>
        You may cancel your subscription at any time through your Profile page
        or by contacting beta@polymorpha.io. Upon cancellation: (a) you retain
        access to paid features for the remainder of your current billing
        period; (b) your account reverts to the free tier at the end of that
        period; (c) no further charges will be made. Cancellation does not
        entitle you to a refund of the current or any prior billing period.
      </P>

      <H3>4. Refund Policy</H3>
      <P>
        As a general rule, we do not provide refunds for partial billing periods
        or for periods where you did not use the Service. However, we may issue
        a refund or account credit at our discretion in the following
        circumstances:
      </P>
      <UL>
        <LI>
          <strong>Service outage:</strong> If a verified technical issue on our
          end prevents you from accessing paid features for more than 72
          consecutive hours
        </LI>
        <LI>
          <strong>Billing error:</strong> If you were charged in error (e.g.,
          duplicate charge, charge after valid cancellation)
        </LI>
        <LI>
          <strong>First-time subscribers:</strong> If you request a refund
          within 7 days of your first paid subscription and have not extensively
          used premium features
        </LI>
      </UL>
      <P>
        Refund requests must be submitted to beta@polymorpha.io within 14 days
        of the disputed charge. Include your account email and a brief
        description of the issue.
      </P>

      <H3>5. Plan Changes</H3>
      <P>
        You may upgrade or downgrade your plan at any time. Upgrades take effect
        immediately with prorated charges for the remainder of the billing
        period. Downgrades take effect at the start of the next billing period.
        Upon downgrade: (a) exports previously generated at a higher tier remain
        accessible; (b) you cannot generate new exports or use features
        exclusive to the higher tier; (c) if your stored data exceeds the lower
        tier's limits, you will be prompted to reduce usage.
      </P>

      <H3>6. Price Changes</H3>
      <P>
        We may change subscription prices with at least 30 days' prior written
        notice (via email to your registered address). Price changes apply at
        the next renewal after the notice period. If you do not agree with a
        price change, you may cancel before the renewal date.
      </P>

      <H3>7. Free Tier</H3>
      <P>
        The free tier is provided at our discretion and may be modified or
        discontinued at any time. Free tier users are not entitled to any
        compensation upon changes to free tier features or limits.
      </P>

      <H3>8. Contact</H3>
      <P>
        For billing enquiries, refund requests, or disputes, contact
        beta@polymorpha.io
      </P>
    </>
  );
}
