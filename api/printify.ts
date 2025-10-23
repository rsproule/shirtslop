import type { VercelRequest, VercelResponse } from "@vercel/node";
import Printify from "printify-sdk-js";

// Configure body parser for larger payloads
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

// Initialize Printify SDK client
let printifyClient: Printify | null = null;

function getPrintifyClient(): Printify {
  const PRINTIFY_TOKEN = process.env.PRINTIFY_TOKEN;
  const SHOP_ID = process.env.PRINTIFY_SHOP_ID;

  if (!PRINTIFY_TOKEN || !SHOP_ID) {
    throw new Error("Missing Printify credentials");
  }

  if (!printifyClient) {
    printifyClient = new Printify({
      accessToken: PRINTIFY_TOKEN,
      shopId: SHOP_ID,
      enableLogging: process.env.NODE_ENV !== "production",
    });
  }

  return printifyClient;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    res.status(200).end();
    return;
  }

  const { action } = req.query as { action: string };

  try {
    const printify = getPrintifyClient();

    switch (action) {
      case "upload":
        return await handleUpload(req, res, printify);

      case "create-product":
        return await handleCreateProduct(req, res, printify);

      case "publish":
        return await handlePublish(req, res, printify);

      case "get-product":
        return await handleGetProduct(req, res, printify);

      default:
        return res.status(400).json({ error: "Invalid action" });
    }
  } catch (error) {
    console.error("Printify API error:", error);
    return res.status(500).json({ error: (error as Error).message });
  }
}

async function handleUpload(
  req: VercelRequest,
  res: VercelResponse,
  printify: Printify,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { imageUrl } = req.body as { imageUrl: string };

  // Extract base64 from data URL (data:image/png;base64,...)
  const base64Data = imageUrl.split(",")[1];

  try {
    const result = await printify.uploads.uploadImage({
      file_name: "design.png",
      contents: base64Data,
    });

    return res.json(result);
  } catch (error) {
    console.error("Upload failed:", error);
    throw new Error(
      `Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

async function handleCreateProduct(
  req: VercelRequest,
  res: VercelResponse,
  printify: Printify,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const result = await printify.products.create(req.body);
    return res.json(result);
  } catch (error) {
    console.error("Create product failed:", error);
    throw new Error(
      `Create product failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

async function handlePublish(
  req: VercelRequest,
  res: VercelResponse,
  printify: Printify,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { productId } = req.body as { productId: string };

  try {
    const result = await printify.products.publishOne(productId, {
      title: true,
      description: true,
      images: true,
      variants: true,
      tags: true,
      keyFeatures: true,
      shipping_template: true,
    });

    return res.json(result);
  } catch (error) {
    console.error("Publish failed:", error);
    throw new Error(
      `Publish failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

async function handleGetProduct(
  req: VercelRequest,
  res: VercelResponse,
  printify: Printify,
) {
  const { productId } = req.query as { productId: string };

  try {
    const result = await printify.products.getOne(productId);
    return res.json(result);
  } catch (error) {
    console.error("Get product failed:", error);
    throw new Error(
      `Get product failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
