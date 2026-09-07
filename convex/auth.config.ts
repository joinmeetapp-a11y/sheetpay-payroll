// Firebase JWT verification for Convex.
// Sheetpay production Firebase project is "mysheetpay".
// FIREBASE_PROJECT_ID may still override this for another deployment, but
// production must never deploy with an empty provider list.
const firebaseProjectId = process.env.FIREBASE_PROJECT_ID || "mysheetpay";

export default {
  providers: [
    {
      domain: `https://securetoken.google.com/${firebaseProjectId}`,
      applicationID: firebaseProjectId,
    },
  ],
};
