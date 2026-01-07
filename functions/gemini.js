export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { prompt, contextData, contextImages } = await request.json();
    const apiKey = env.GEMINI_API_KEY;
    const model = env.GEMINI_MODEL || "gemini-2.0-flash";

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API Key not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Construct the full prompt text
    let fullPrompt = "あなたは社内アシスタントAIです。以下の社内資料（コンテキスト）および添付された画像に基づいて、ユーザーの質問に回答してください。\nもし資料に答えがない場合は、一般的な知識で回答せず、「資料には記載がありません」と答えてください。\n\n";
    if (contextData) {
      fullPrompt += `=== 社内資料 (テキスト) ===\n${contextData}\n================\n\n`;
    }
    fullPrompt += `ユーザーの質問: ${prompt}`;

    // Construct API Payload
    const parts = [{ text: fullPrompt }];

    // Add Images if available
    if (contextImages && Array.isArray(contextImages) && contextImages.length > 0) {
        contextImages.forEach(base64Image => {
            // Ensure base64 string doesn't contain data URI prefix for inlineData
            // Typically "data:image/jpeg;base64,..."
            const match = base64Image.match(/^data:(.*?);base64,(.*)$/);
            if (match) {
                parts.push({
                    inlineData: {
                        mimeType: match[1],
                        data: match[2]
                    }
                });
            }
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
