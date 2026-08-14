import type { VercelRequest, VercelResponse } from "@vercel/node";
import Printify, { type NewProduct } from "printify-sdk-js";

// Configure body parser for larger payloads
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

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
  const PRINTIFY_TOKEN = process.env.PRINTIFY_TOKEN;
  const SHOP_ID = process.env.PRINTIFY_SHOP_ID;

  if (!PRINTIFY_TOKEN || !SHOP_ID) {
    return res.status(500).json({ error: "Missing Printify credentials" });
  }

  const printify = new Printify({
    accessToken: PRINTIFY_TOKEN,
    shopId: SHOP_ID,
    enableLogging: false,
  });

  try {
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

  const payload = {
    file_name: "design.png",
    contents: base64Data,
  };

  const result = await printify.uploads.uploadImage(payload);
  return res.json(result);
}

async function handleCreateProduct(
  req: VercelRequest,
  res: VercelResponse,
  printify: Printify,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const result = await printify.products.create(req.body as NewProduct);
  return res.json(result);
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

  await printify.products.publishOne(productId, {
    title: true,
    description: true,
    images: true,
    variants: true,
    tags: true,
    keyFeatures: true,
    shipping_template: true,
  });

  return res.json({});
}

async function handleGetProduct(
  req: VercelRequest,
  res: VercelResponse,
  printify: Printify,
) {
  const { productId } = req.query as { productId: string };

  const result = await printify.products.getOne(productId);
  return res.json(result);
}
