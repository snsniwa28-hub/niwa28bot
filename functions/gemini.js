export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { prompt, contextData } = await request.json();
    const apiKey = env.GEMINI_API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API Key not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Construct the full prompt
    let fullPrompt = "あなたは社内アシスタントAIです。以下の社内資料（コンテキスト）に基づいて、ユーザーの質問に回答してください。\nもし資料に答えがない場合は、一般的な知識で回答せず、「資料には記載がありません」と答えてください。\n\n";
    if (contextData) {
      fullPrompt += `=== 社内資料 ===\n${contextData}\n================\n\n`;
    }
    fullPrompt += `ユーザーの質問: ${prompt}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: fullPrompt }]
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
