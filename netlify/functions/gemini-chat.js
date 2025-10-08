// Netlify Functionsのサーバーサイドコード
// このファイルが、APIキーを安全に保ちながらGoogleのAIと通信する役割を担います。

exports.handler = async function(event) {
    // POSTリクエスト以外は受け付けない設定
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        // Webページ側から送られてきたチャット内容や機種リストを取得
        const { userQuery, machineList, newOpeningList } = JSON.parse(event.body);
        
        // Netlifyの環境変数に設定したAPIキーを安全に取得
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            throw new Error("APIキーがNetlifyの環境変数に設定されていません。");
        }
        
        // 特別なキーワード「たけし」を先に処理
        if (userQuery.includes('たけし')) {
            const takeshiResponse = 'ああ！くっさいカレーのことですね！\n八潮店にはカレーが生息しています！\nよければ食べに来てください！\nありがとうございます！';
            return {
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: takeshiResponse })
            };
        }

        // AIへの指示書（システムプロンプト）を作成
        const systemPrompt = `あなたはパチンコ・パチスロ店の優秀なセールスBOTです。ユーザーからの質問に対して、あなたが把握している情報を基に、誠実かつ魅力的に回答してください。

あなたが把握している情報は以下の通りです。
1.  **遊技機リスト**: 各台のスペックやセールスポイントが記載されています。機種名やスペックに関する質問には、このリストを基に回答してください。
2.  **新装開店情報**: 次回の新装開店で導入される機種と台数が記載されています。「新装開店」に関する質問（例：「新装開店の台は？」「導入台数は？」）には、このリストを基に、機種名と台数を分かりやすく一覧で回答してください。

特別なルール:
- 「新台」という単語を含む質問（例：「新台教えて」）で、かつ「新装開店」という単語を含まない場合は、遊技機リストの中から'pachinko'または'pachislot'タイプを持つ機種のみをピックアップして紹介してください。

上記以外の情報や、リストにない機種、雑談などには答えられません。「申し訳ありませんが、その情報については分かりかねます。」と回答してください。
セールストークを求められた場合は、必ず「お客様、」から始めてください。

---
### 遊技機リスト
${JSON.stringify(machineList, null, 2)}

---
### 新装開店情報 (2025/10/21)
${JSON.stringify(newOpeningList, null, 2)}
`;

        // GoogleのAIに送るデータを作成
        const payload = {
            contents: [{ parts: [{ text: userQuery }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
        };

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

        // GoogleのAIサーバーと通信
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Google API error: ${response.statusText} - ${errorBody}`);
        }

        const result = await response.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        
        // AIからの返事をWebページに返す
        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: text || "申し訳ありません、うまく応答できませんでした。" })
        };

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'サーバー内部でエラーが発生しました。' })
        };
    }
};



