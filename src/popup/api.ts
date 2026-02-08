export const API_URL =
  process.env.PLASMO_PUBLIC_INTRODB_API || "https://api.theintrodb.org/v1"

export const api = typeof browser !== "undefined" ? browser : chrome
