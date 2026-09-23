import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";

import { firebaseAuth } from "../config/firebase";

const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({
  prompt: "select_account",
});

export const signInWithGoogle = async () => {
  const result = await signInWithPopup(firebaseAuth, googleProvider);

  const idToken = await result.user.getIdToken();

  return {
    idToken,
    user: result.user,
  };
};
