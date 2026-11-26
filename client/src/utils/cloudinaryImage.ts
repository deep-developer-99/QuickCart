export interface CloudinaryImageOptions {
  width?: number;
}

const isTransformationSegment = (segment: string) => /^(?:a|ar|b|bo|c|d|dpr|e|f|fl|g|h|l|o|q|r|s|t|u|w|x|y|z)_/.test(segment);

const parseCloudinaryUrl = (src: string) => {
  try {
    const url = new URL(src);
    return url.hostname === "res.cloudinary.com" ? url : null;
  } catch {
    return null;
  }
};

export const optimizeCloudinaryImageUrl = (src: string, options: CloudinaryImageOptions = {}) => {
  const url = parseCloudinaryUrl(src);
  if (!url) return src;

  const parts = url.pathname.split("/");
  const uploadIndex = parts.indexOf("upload");
  if (uploadIndex < 0) return src;
  const nextIndex = uploadIndex + 1;
  const transforms = isTransformationSegment(parts[nextIndex] ?? "")
    ? parts[nextIndex].split(",")
    : [];
  if (transforms.length) parts.splice(nextIndex, 1);

  const clean = transforms.filter((item) => !item.startsWith("f_") && !item.startsWith("q_") && !item.startsWith("w_"));
  clean.push("f_auto", "q_auto");
  if (options.width && Number.isFinite(options.width) && options.width > 0) clean.push(`w_${Math.round(options.width)}`);
  parts.splice(nextIndex, 0, clean.join(","));
  url.pathname = parts.join("/");
  return url.toString();
};

export const createCloudinarySrcSet = (src: string, widths: number[]) => {
  if (!parseCloudinaryUrl(src)) return undefined;
  return widths.map((width) => `${optimizeCloudinaryImageUrl(src, { width })} ${width}w`).join(", ");
};
