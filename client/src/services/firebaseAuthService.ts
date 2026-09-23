import {
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth/web-extension";

import { firebaseAuth } from "../config/firebase";

const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  const result = await signInWithPopup(firebaseAuth, googleProvider);

  const idToken = await result.user.getIdToken();

  return {
    idToken,
    user: result.user,
  };
};
