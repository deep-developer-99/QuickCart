import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";

import { clearFirebaseAuthSession, firebaseAuth, initializeFirebaseAuthSession } from "../config/firebase";

const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({
  prompt: "select_account",
});

export const signInWithGoogle = async () => {
  await initializeFirebaseAuthSession();
  try {
    const result = await signInWithPopup(firebaseAuth, googleProvider);
    const idToken = await result.user.getIdToken();
    try {
      await signOutFirebaseAuth();
    } catch (error) {
      console.error("Firebase sign-out after token creation failed:", error);
    }
    return { idToken };
  } catch (error) {
    if (firebaseAuth.currentUser) {
      try {
        await signOutFirebaseAuth();
      } catch (signOutError) {
        console.error("Firebase sign-out after Google sign-in failure failed:", signOutError);
      }
    }
    throw error;
  }
};

export const signOutFirebaseAuth = async () => {
  await clearFirebaseAuthSession();
};
