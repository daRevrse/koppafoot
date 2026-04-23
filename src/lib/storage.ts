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
  await uploadBytes(storageRef, file, { contentType: file.type });
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
  await uploadBytes(storageRef, file, { contentType: file.type });
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
  await uploadBytes(storageRef, file, { contentType: file.type });
  return getDownloadURL(storageRef);
}

/**
 * Upload a team logo. Max 2MB, images only.
 */
export async function uploadTeamLogo(teamId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `teams/${teamId}/logo/logo.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return getDownloadURL(storageRef);
}

/**
 * Upload a team banner. Max 5MB, images only.
 */
export async function uploadTeamBanner(teamId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `teams/${teamId}/banner/banner.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return getDownloadURL(storageRef);
}

/**
 * Upload an image to the team gallery.
 */
export async function uploadTeamGalleryImage(teamId: string, file: File): Promise<string> {
  const timestamp = Date.now();
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `teams/${teamId}/gallery/${timestamp}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return getDownloadURL(storageRef);
}

/**
 * Upload a venue photo.
 */
export async function uploadVenuePhoto(venueId: string, file: File): Promise<string> {
  const timestamp = Date.now();
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `venues/${venueId}/photos/${timestamp}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return getDownloadURL(storageRef);
}
