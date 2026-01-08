export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { prompt, contextData, contextImages, mode } = await request.json();
    const apiKey = env.GEMINI_API_KEY;
    const model = env.GEMINI_MODEL || "gemini-2.0-flash";

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API Key not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    let fullPrompt = "";

    if (mode === 'extraction') {
        // Extraction Mode for Operations Targets
        fullPrompt = `
あなたはデータ抽出AIです。
提供されたテキストデータ（CSV形式含む）または画像から、**「15時時点の目標値」**と**「19時時点の目標値」**を日付ごとに抽出してください。
以下のJSON形式のみを出力してください。余計な解説やMarkdown記法（\`\`\`jsonなど）は一切不要です。

【出力フォーマット】
{
  "YYYY-MM-DD": { "t15": 数値, "t19": 数値 },
  ...
}

【ルール】
1. 日付は YYYY-MM-DD 形式（例: 2024-12-01）。
2. **t15**: 「15時」または「午後3時」の「目標」稼働数。
3. **t19**: 「19時」または「午後7時」の「目標」稼働数。
   - 「実績」ではなく**「目標」**を優先して抽出すること。
4. 表データ（CSV等）の場合、列の並びを考慮して正しい値を紐付けてください。
5. 数値が見つからない日付は除外してください。
6. JSON以外のテキストは一切出力しないでください。

解析対象データ:
${prompt}
`;
    } else {
        // Normal Chat Mode (Updated Persona)
        fullPrompt = `あなたは現場のアシスタントAIです。
以下の【社内資料】に基づいて、ユーザーの質問に**即答**してください。

【厳格な回答ルール】
1. **結論ファースト**: 最初に答えを短く述べる。
2. **要約・極短文**: 冗長な解説は禁止。現場で一瞬で読める長さに留める。
3. **記号の制限**:
   - アスタリスク (*) や太字Markdownは**一切使用禁止**。
   - 箇条書きは「・」または「1.」のみ使用可能。
4. **情報の優先度**: 社内資料の内容を最優先する。資料にない場合は「資料にありません」と即答する。
5. **丁寧語**: です・ます調を使用。

`;
        if (contextData) {
            fullPrompt += `${contextData}\n\n`;
        }
        fullPrompt += `質問: ${prompt}`;
    }

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
