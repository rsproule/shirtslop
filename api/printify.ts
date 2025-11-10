import type { VercelRequest, VercelResponse } from "@vercel/node";

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

  try {
    switch (action) {
      case "upload":
        return await handleUpload(req, res, PRINTIFY_TOKEN);

      case "create-product":
        return await handleCreateProduct(req, res, PRINTIFY_TOKEN, SHOP_ID);

      case "publish":
        return await handlePublish(req, res, PRINTIFY_TOKEN, SHOP_ID);

      case "get-product":
        return await handleGetProduct(req, res, PRINTIFY_TOKEN, SHOP_ID);

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
  token: string,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { imageUrl, blobUrl } = req.body as {
    imageUrl?: string;
    blobUrl?: string;
  };

  let base64Data: string;

  if (blobUrl) {
    // Fetch image from Vercel Blob URL
    console.log("📥 Fetching image from Blob URL:", blobUrl);
    const blobResponse = await fetch(blobUrl);
    if (!blobResponse.ok) {
      throw new Error(
        `Failed to fetch blob: ${blobResponse.status} - ${blobResponse.statusText}`,
      );
    }
    const arrayBuffer = await blobResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    base64Data = buffer.toString("base64");
    console.log("✅ Fetched blob, size:", buffer.length, "bytes");
  } else if (imageUrl) {
    // Legacy: Extract base64 from data URL (data:image/png;base64,...)
    base64Data = imageUrl.split(",")[1];
  } else {
    return res.status(400).json({
      error: "Either 'blobUrl' or 'imageUrl' must be provided",
    });
  }

  const payload = {
    file_name: "design.png",
    contents: base64Data,
  };

  const response = await fetch(
    "https://api.printify.com/v1/uploads/images.json",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Upload failed: ${response.status} - ${error}`);
  }

  const result = await response.json();
  return res.json(result);
}

async function handleCreateProduct(
  req: VercelRequest,
  res: VercelResponse,
  token: string,
  shopId: string,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const response = await fetch(
    `https://api.printify.com/v1/shops/${shopId}/products.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req.body),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Create product failed: ${response.status} - ${error}`);
  }

  const result = await response.json();
  return res.json(result);
}

async function handlePublish(
  req: VercelRequest,
  res: VercelResponse,
  token: string,
  shopId: string,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { productId } = req.body as { productId: string };

  const response = await fetch(
    `https://api.printify.com/v1/shops/${shopId}/products/${productId}/publish.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: true,
        description: true,
        images: true,
        variants: true,
        tags: true,
        keyFeatures: true,
        shipping_template: true,
      }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Publish failed: ${response.status} - ${error}`);
  }

  const result = await response.json();
  return res.json(result);
}

async function handleGetProduct(
  req: VercelRequest,
  res: VercelResponse,
  token: string,
  shopId: string,
) {
  const { productId } = req.query as { productId: string };

  const response = await fetch(
    `https://api.printify.com/v1/shops/${shopId}/products/${productId}.json`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Get product failed: ${response.status} - ${error}`);
  }

  const result = await response.json();
  return res.json(result);
}
