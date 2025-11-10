import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(req: VercelRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk: Buffer) => {
      data += chunk.toString();
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<VercelResponse> {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,OPTIONS,PATCH,DELETE,POST,PUT",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version",
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const bodyText = await getRawBody(req);
    const body = JSON.parse(bodyText) as HandleUploadBody;

    // Construct URL for Request object
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers.host || "localhost:3000";
    const url = `${protocol}://${host}${req.url}`;

    // Create Request object compatible with handleUpload
    const request = new Request(url, {
      method: req.method || "POST",
      headers: req.headers as HeadersInit,
      body: bodyText,
    });

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async pathname => {
        return {
          allowedContentTypes: ["image/png", "image/jpeg", "image/webp"],
          addRandomSuffix: false, // Deterministic paths based on hash
          tokenPayload: JSON.stringify({ pathname }),
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log("✅ Blob upload completed:", blob.url);
      },
    });

    return res.json(jsonResponse);
  } catch (error) {
    console.error("❌ Blob upload error:", error);
    return res.status(400).json({
      error: (error as Error).message,
    });
  }
}
