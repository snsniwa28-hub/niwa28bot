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

    } else if (mode === 'update_category_summary') {
        // --- Update Category Summary Mode (Batch Processing) ---
        const systemPrompt = `
あなたは社内資料の統括責任者AIです。
提供された複数の社内資料（テキスト・画像）を分析し、スタッフ全員に共有するための**「統合サマリーレポート」**を作成してください。
以下のJSON形式のみを出力してください。

【出力フォーマット】
{
  "short": "本日(${currentDate})から4日後までの予定と、重要ルールのみをまとめたレポート（Markdown形式）",
  "full": "5日後以降の予定も含めた、すべての情報を網羅した詳細レポート（Markdown形式）"
}

【スタイル・表現の絶対ルール】
**「視覚的に見やすいカード型デザイン」**を意識して作成してください。

1. **見出し（カードの区切り）**: 日付や大きな話題の変わり目は必ず \`##\` を使ってください。（例: \`## 📅 10/25 (金)\`）
   - これが「カード」の区切りになります。
2. **小見出し**: カードの中での話題の区切りは \`###\` を使ってください。（例: \`### 🎰 スロットコーナー\`）
3. **重要アラート（強調ボックス）**: 特に注意すべき警告や絶対に守るべきルールは \`> \` (引用記号) で囲ってください。
   - 例: \`> ⚠️ 遅刻厳禁！必ず15分前に集合してください。\`
   - これにより、赤い強調ボックスとして表示されます。
4. **絵文字フル活用**: 箇条書き記号（・や-）の代わりに、必ず絵文字を行頭に使ってください。（✅, ⚠️, 🗓️, ℹ️, 🅿️, 🎰, 🛑, ✨など）
5. **強調**: 重要な箇所は \`**\` で囲み、目立たせてください。
6. **トーン**: 元気よく、かつ分かりやすく。「〜です！」「〜しましょう」といった語尾もOK。

【内容の振り分け】
- **short (直近版)**:
    - 本日(${currentDate}) 〜 4日後までの日付指定がある情報
    - 日付指定のない、常に重要なルールや通達
    - **未来すぎる情報（5日後以降）はここには含めないでください。**
- **full (完全版)**:
    - shortの内容すべて
    - 5日後以降の未来の予定
    - 資料にある細かい補足情報すべて

【対象資料】
${contextData}
`;
        const parts = [{ text: systemPrompt }];
        // Add Images (Batch from all docs)
        if (contextImages && Array.isArray(contextImages)) {
            // contextImages might be large, Gemini limits apply. We assume reasonable usage.
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
**「視覚的に見やすいカード型デザイン」**を意識して作成してください。

1. **見出し（カードの区切り）**: 日付や大きな話題の変わり目は必ず \`##\` を使ってください。（例: \`## 📅 12/1 (金)\`）
2. **重要アラート**: 特に重要な警告は \`> \` (引用) を使って囲ってください。（例: \`> ⚠️ 18時完全撤収\`）
3. **絵文字活用**: 箇条書き記号の代わりに、必ず絵文字を行頭に使ってください。（✅, ⚠️, ℹ️, 📌, ✨）
4. **強調**: 重要なキーワードや時間は \`**\` で囲って強調してください。（例: \`**10:00** MTG\`）
5. **挨拶不要:** いきなり要約から始めてください。
6. **情報なし:** 該当する情報がない場合は「直近の予定や重要事項はありません。」と答えてください。

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
