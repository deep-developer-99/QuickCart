import { UploadApiResponse } from "cloudinary";

import cloudinary from "../config/cloudinary";

export const uploadImageToCloudinary = (
  buffer: Buffer,
  folder: string,
): Promise<UploadApiResponse> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        if (!result) {
          reject(new Error("Cloudinary upload failed."));
          return;
        }

        resolve(result);
      },
    );

    uploadStream.end(buffer);
  });
};

export const deleteImageFromCloudinary = async (
  publicId: string,
): Promise<void> => {
  await cloudinary.uploader.destroy(publicId, {
    resource_type: "image",
  });
};
