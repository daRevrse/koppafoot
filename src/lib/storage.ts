import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";

/**
 * Upload a profile photo (avatar or cover) to Firebase Storage.
 * Returns the public download URL.
 */
export async function uploadProfilePhoto(
  uid: string,
  file: File,
  type: "avatar" | "cover"
): Promise<string> {
  const timestamp = Date.now();
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `users/${uid}/${type}_${timestamp}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}
