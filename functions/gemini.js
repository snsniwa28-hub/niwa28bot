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

    } else if (mode === 'analyze_strategy') {
        // --- Analyze Strategy Mode (Generate Chat Content) ---
        const systemPrompt = `
あなたは社内資料の分析官です。
提供されたテキストと画像を分析し、チャットボット用の「要約データ」を作成してください。
以下のJSON形式のみを出力してください。余計な解説やMarkdown記法（\`\`\`jsonなど）は一切不要です。

【出力フォーマット】
{
  "ai_summary": "チャットの冒頭に表示する、2-3行の簡潔な要約（キャッチーに）",
  "ai_details": "ユーザーが『詳しく知りたい』とボタンを押した時に表示する詳細な解説（Markdown形式で、見出しや箇条書きを駆使して読みやすく）",
  "relevant_date": "YYYY-MM-DD" または null
}

【ルール】
1. **relevant_date**: 記事の内容が特定のイベントや日付に関するものであれば、その日付（YYYY-MM-DD）を抽出してください。期限や実施日など。特になければ null (Javascriptのnull値)。
2. **ai_summary**: ユーザーが興味を持つように短くまとめてください。
3. **ai_details**: ここには本文の内容を網羅的に、かつ構造化して記述してください。
4. JSONとしてパースできない文字が含まれないように注意してください。

【対象コンテンツ】
タイトル: ${prompt}
内容:
${contextData}
`;
        const parts = [{ text: systemPrompt }];
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
以下の【社内資料】の内容を分析し、**「本日（${currentDate}）から4日先まで」**の予定と、**「日付指定のない重要情報」**を要約して伝えてください。

【抽出ルール】
1. **対象期間:** **${currentDate} (本日)** から **4日後** までの情報のみ抽出してください。（それより先の日付は除外）
2. **日付なし情報:** 日付が明記されていない普遍的なルールや知識、通達は**必ず含めて**ください。
3. **過去情報:** 本日より前の情報は除外してください。

【フォーマット・見た目】
1. **見出し:** 日付ごとの区切りは \`## 📅 12/1 (金)\` のように \`##\` を使って大きく表示してください。
2. **箇条書き:** 単なる黒丸ではなく、内容に合わせて絵文字を使ってください。（例: ✅, ⚠️, ℹ️, 📌）
3. **強調:** 重要なキーワードや時間は \`**\` で囲って強調してください。（例: \`**10:00** MTG\`）
4. **挨拶不要:** いきなり要約から始めてください。
5. **情報なし:** 該当する情報がない場合は「直近の予定や重要事項はありません。」と答えてください。

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
