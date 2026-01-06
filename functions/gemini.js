export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { prompt, contextData, images } = await request.json();
    const apiKey = env.GEMINI_API_KEY;
    // User requested "2.5 flash".
    // Setting default to gemini-2.5-flash based on user request.
    const model = env.GEMINI_MODEL || "gemini-2.5-flash";

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API Key not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Construct the parts array
    const parts = [];

    // 1. System Instruction / Context (as text)
    let systemText = "あなたは社内アシスタントAIです。以下の社内資料（コンテキスト）に基づいて、ユーザーの質問に回答してください。\nもし資料に答えがない場合は、一般的な知識で回答せず、「資料には記載がありません」と答えてください。\n\n";
    if (contextData) {
      systemText += `=== 社内資料 ===\n${contextData}\n================\n\n`;
    }
    systemText += `ユーザーの質問: ${prompt}`;

    parts.push({ text: systemText });

    // 2. Images (if any)
    if (images && Array.isArray(images)) {
      images.forEach(imgBase64 => {
        // Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
        const base64Data = imgBase64.split(',')[1] || imgBase64;
        // Assuming jpeg for simplicity, or we could pass mimeType from client
        // Gemini API supports image/png, image/jpeg, image/webp, image/heic, image/heif
        parts.push({
          inline_data: {
            mime_type: "image/jpeg",
            data: base64Data
          }
        });
      });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{
          parts: parts
        }]
      }),
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    // Handle safety ratings or empty content if necessary
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error("No response generated.");
    }

    const reply = data.candidates[0].content.parts[0].text;

    return new Response(JSON.stringify({ reply }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
