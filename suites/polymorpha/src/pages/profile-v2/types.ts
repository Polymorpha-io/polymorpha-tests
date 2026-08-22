import { PROFILE_SECTIONS } from "./constants";

export type ProfileSection =
  (typeof PROFILE_SECTIONS)[keyof typeof PROFILE_SECTIONS];
