import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/board", "/launch", "/dashboard", "/learn"].map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
  }));
}
