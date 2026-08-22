import { TermsContent } from "./TermsContent";
import { PrivacyContent } from "./PrivacyContent";
import { CookiesContent } from "./CookiesContent";
import { AUPContent } from "./AUPContent";
import { RefundsContent } from "./RefundsContent";
import type { SectionId } from "./legalShared";

type ContentComponent = typeof TermsContent;

export const CONTENT_MAP: Record<SectionId, ContentComponent> = {
  terms: TermsContent,
  privacy: PrivacyContent,
  cookies: CookiesContent,
  aup: AUPContent,
  refunds: RefundsContent,
};
