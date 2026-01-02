const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Gemini API Client Initialization
// 修正: ハードコーディングを廃止し、環境変数またはデフォルト設定を使用
// functions/.env に GEMINI_API_KEY が設定されていることを前提とします
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- Existing Function for CS/Article Mode ---
exports.generateArticleFromPdf = onCall({ cors: true, maxInstances: 10, timeoutSeconds: 60 }, async (request) => {
    const { pdfBase64, mimeType } = request.data;

    if (!pdfBase64) {
        throw new HttpsError('invalid-argument', 'The function must be called with a "pdfBase64" argument.');
    }

    try {
        // Updated to latest model
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const prompt = `
役割: あなたはパチンコ店の優秀な店長兼マーケターです。
入力: パチンコ・スロットの機種スペック資料、CS（接客）マニュアル、営業戦略資料などのPDF。
タスク: 資料の種類（機種モノか、接客モノか等）を自動で判断し、スタッフ共有用のわかりやすい記事形式に要約すること。
出力形式: 以下のJSONフォーマットのみを返却すること（Markdown記法は不要）。

JSON
{
  "title": "資料の内容を一言で表すキャッチーなタイトル",
  "blocks": [
    { "type": "text", "importance": "important", "text": "【結論・最重要ポイント】\\n（機種なら導入日や大当り確率、CSなら変更点など）" },
    { "type": "text", "importance": "normal", "text": "【詳細解説】\\n（スペック詳細、ゲームフロー、具体的な手順など）" },
    { "type": "text", "importance": "info", "text": "【補足・注意点】\\n（運用上の注意、ターゲット層など）" }
  ]
}
要件:
重要度（importance）は内容に応じて important (赤), normal (白), info (青), gold (金) から適切に選択すること。
OCR読み取りミスと思われる箇所は文脈から補正すること。
        `;

        const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, "");

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: cleanBase64,
                    mimeType: mimeType || "application/pdf",
                },
            },
        ]);

        const response = await result.response;
        let text = response.text();

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
             console.error("Invalid AI response format:", text);
             throw new Error("Invalid JSON response from AI");
        }

        const parsedData = JSON.parse(jsonMatch[0]);
        return parsedData;

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        throw new HttpsError('internal', 'Failed to generate article from PDF.', error.message);
    }
});

// --- New Function: Extract Text for Knowledge Base ---
exports.extractTextFromPdf = onCall({ cors: true, maxInstances: 10, timeoutSeconds: 60 }, async (request) => {
    const { pdfBase64, mimeType } = request.data;

    if (!pdfBase64) {
        throw new HttpsError('invalid-argument', 'The function must be called with a "pdfBase64" argument.');
    }

    try {
        // Updated to latest model
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const prompt = `
役割: OCRアシスタント
タスク: 提供されたPDF画像から、テキスト情報を可能な限り詳細に、漏れなく抽出してください。
目的: このテキストは、後でAIチャットボットがユーザーの質問に答えるための知識ベース（コンテキスト）として使用されます。
出力: 抽出したテキストのみを返してください。余計な挨拶やJSON装飾は不要です。
特に、数値（確率、日付など）や固有名詞は正確に書き出してください。
        `;

        const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, "");

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: cleanBase64,
                    mimeType: mimeType || "application/pdf",
                },
            },
        ]);

        const response = await result.response;
        const text = response.text();
        return { text: text };

    } catch (error) {
        console.error("Error extracting text:", error);
        throw new HttpsError('internal', 'Failed to extract text from PDF.', error.message);
    }
});

// --- New Function: Chat with Knowledge ---
exports.chatWithKnowledge = onCall({ cors: true, maxInstances: 10, timeoutSeconds: 60 }, async (request) => {
    const { message, context, history } = request.data;

    if (!message || !context) {
        throw new HttpsError('invalid-argument', 'Message and Context are required.');
    }

    try {
        // Updated to latest model
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        let historyText = "";
        if (history && Array.isArray(history)) {
            historyText = history.map(h => `${h.role === 'user' ? 'User' : 'AI'}: ${h.text}`).join("\n");
        }

        const prompt = `
あなたはパチンコホールの「AIナレッジアシスタント」です。
以下の【資料テキスト】に基づいて、ユーザー（ホールスタッフ）の質問に答えてください。

【資料テキスト】
${context}

【会話履歴】
${historyText}

【ユーザーの質問】
${message}

【回答のガイドライン】
1. 資料に書かれていることに基づいて回答してください。資料にない場合は「資料には記載がありません」と正直に答えてください。
2. 箇条書きや太字を使って、読みやすく簡潔に答えてください。
3. 丁寧すぎず、プロフェッショナルかつフレンドリーな口調で。
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return { reply: response.text() };

    } catch (error) {
        console.error("Error in chat:", error);
        throw new HttpsError('internal', 'Failed to generate chat response.', error.message);
    }
});