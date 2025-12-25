const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Gemini API Client Initialization
// NOTE: Ensure the GEMINI_API_KEY environment variable is set in Firebase Functions configuration.
// Command: firebase functions:secrets:set GEMINI_API_KEY
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.generateArticleFromPdf = onCall({ cors: true, maxInstances: 10, timeoutSeconds: 60 }, async (request) => {
    const { pdfBase64, mimeType } = request.data;

    if (!pdfBase64) {
        throw new HttpsError('invalid-argument', 'The function must be called with a "pdfBase64" argument.');
    }

    try {
        // Use the latest Flash model alias
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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

        // Clean Base64 string if it contains data URI prefix
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

        // Extract JSON from the response (handle potential Markdown code blocks)
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
