/** Legacy accounts retain access. New accountant accounts require email ownership. */
export function accountantEmailAccess(user: any, identity: any): boolean {
  if (!user?.emailVerificationRequired || process.env.ACCOUNTANT_EMAIL_VERIFICATION_ENABLED !== "true") return true;
  const email = typeof identity?.email === "string" ? identity.email.trim().toLowerCase() : "";
  return !!email && email === user.email &&
    (identity.emailVerified === true || user.verifiedEmail === email);
}

export function requireVerifiedAccountantEmail(user: any, identity: any) {
  if (!accountantEmailAccess(user, identity)) throw new Error("EMAIL_VERIFICATION_REQUIRED: Verify your email before opening your accountant workspace.");
}
