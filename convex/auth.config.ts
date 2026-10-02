// Firebase JWT verification for Convex.
// Accountant email/password users remain on "myglowtext".
// Sheetpay Mobile beta users may enter Accountant with their already verified
// "mysheetpay" Google session, so both first-party Firebase issuers are trusted.
const firebaseProjectId = process.env.FIREBASE_PROJECT_ID || "myglowtext";
const firebaseProjectIds = Array.from(new Set([firebaseProjectId, "mysheetpay"]));

export default {
  providers: firebaseProjectIds.map((projectId) => ({
    domain: `https://securetoken.google.com/${projectId}`,
    applicationID: projectId,
  })),
};
