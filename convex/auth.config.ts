// Firebase JWT verification for Convex.
// Set FIREBASE_PROJECT_ID via: npx convex env set FIREBASE_PROJECT_ID <your-project-id>
export default {
  providers: process.env.FIREBASE_PROJECT_ID
    ? [
        {
          domain: `https://securetoken.google.com/${process.env.FIREBASE_PROJECT_ID}`,
          applicationID: process.env.FIREBASE_PROJECT_ID,
        },
      ]
    : [],
};
