export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { prompt, contextData, contextImages, mode, history, currentDate } = await request.json();
    const apiKey = env.GEMINI_API_KEY;
    const model = env.GEMINI_MODEL || "gemini-2.0-flash";

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API Key not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    let contents = [];

    if (mode === 'extraction') {
        // Extraction Mode for Operations Targets
        const fullPrompt = `
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
        const parts = [{ text: fullPrompt }];
        // Add Images
        if (contextImages && Array.isArray(contextImages)) {
            contextImages.forEach(base64Image => {
                const match = base64Image.match(/^data:(.*?);base64,(.*)$/);
                if (match) parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
            });
        }
        contents = [{ parts: parts }];

    } else if (mode === 'summary') {
        // --- Summary Mode ---
        const systemPrompt = `
あなたは社内資料の要約アシスタントです。
以下の【社内資料】の内容を分析し、**「本日（${currentDate}）以降」**に関連する重要な情報を要約してユーザーに伝えてください。

【要約ルール】
1. **本日は ${currentDate} です。** これより古い日付のイベントや期限切れの情報は省いてください（ただし、日付のない普遍的なルールや知識は含めます）。
2. 箇条書きを使用して、視覚的にわかりやすくまとめてください。
3. 挨拶は不要です。いきなり要約から始めてください。
4. 情報がない場合は、「本日以降に関連する特筆すべき情報はありません。」と答えてください。
5. 出力はプレーンテキストで行い、Markdownは最小限（箇条書き程度）にしてください。

【社内資料】
${contextData || "（資料なし）"}
`;
        const parts = [{ text: systemPrompt }];
        // Add Images for context
        if (contextImages && Array.isArray(contextImages)) {
            contextImages.forEach(base64Image => {
                const match = base64Image.match(/^data:(.*?);base64,(.*)$/);
                if (match) parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
            });
        }
        contents = [{ role: 'user', parts: parts }];

    } else {
        // --- Normal Chat Mode (With History) ---
        const systemPrompt = `
あなたは現場のアシスタントAIです。
以下の【社内資料】を記憶した状態で、ユーザーの質問に答えてください。

【基本ルール】
1. **結論ファースト**: 通常は簡潔に答えてください。
2. **詳細対応**: ユーザーが「詳しく」「具体的に」と聞いた場合や、質問の文脈が詳細を求めている場合は、制限を解除して丁寧に詳しく解説してください。
3. **曖昧検索**: ユーザーの質問が曖昧な場合（例：「あれどうなってる？」「遅番のやつ」）は、資料の文脈から最も可能性の高い情報を推測して答えてください。推測した場合は「〜に関する件ですね？」と確認を入れてください。
4. **日付認識**: 本日は **${currentDate}** です。未来・過去の判定はこの日付を基準にしてください。
5. **情報の優先度**: 社内資料の内容を絶対的な正解として扱ってください。資料にない場合は正直に「資料にありません」と答えてください。
6. **丁寧語**: です・ます調を使用。

【社内資料】
${contextData || "（資料なし）"}
`;

        // Use history
        contents = history ? JSON.parse(JSON.stringify(history)) : [];

        if (contents.length === 0) {
            contents.push({ role: 'user', parts: [{ text: prompt }] });
        }

        // Inject System Prompt and Context into the FIRST User message
        const firstUserIndex = contents.findIndex(c => c.role === 'user');
        if (firstUserIndex !== -1) {
            const originalText = contents[firstUserIndex].parts[0].text;
            // Prepend System Prompt
            contents[firstUserIndex].parts[0].text = `${systemPrompt}\n\nUser Question: ${originalText}`;

            // Attach Images to the first message
            if (contextImages && Array.isArray(contextImages)) {
                contextImages.forEach(base64Image => {
                    const match = base64Image.match(/^data:(.*?);base64,(.*)$/);
                    if (match) {
                        contents[firstUserIndex].parts.push({
                            inlineData: { mimeType: match[1], data: match[2] }
                        });
                    }
                });
            }
        } else {
             // Fallback if no user message found (rare)
             contents.unshift({ role: 'user', parts: [{ text: systemPrompt }] });
        }
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: contents
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
