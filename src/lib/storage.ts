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

/**
 * Upload a gallery photo to Firebase Storage.
 * Returns the public download URL.
 */
export async function uploadGalleryPhoto(
  uid: string,
  file: File
): Promise<string> {
  const timestamp = Date.now();
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `users/${uid}/gallery/${timestamp}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

/**
 * Upload a media file attached to a post.
 * Returns the public download URL.
 */
export async function uploadPostMedia(postId: string, file: File): Promise<string> {
  const timestamp = Date.now();
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `posts/${postId}/media/${timestamp}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}
