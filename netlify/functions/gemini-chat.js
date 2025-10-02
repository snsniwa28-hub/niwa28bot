// Netlify Functionsのサーバーサイドコード
// このファイルが、APIキーを安全に保ちながらGoogleのAIと通信する役割を担います。

exports.handler = async function(event) {
    // POSTリクエスト以外は受け付けない設定
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        // Webページ側から送られてきたチャット内容や機種リストを取得
        const { userQuery, machineList } = JSON.parse(event.body);
        
        // Netlifyの環境変数に設定したAPIキーを安全に取得
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            throw new Error("APIキーがNetlifyの環境変数に設定されていません。");
        }
        
        let systemPrompt;

        // ユーザーの質問に「新台」が含まれているかチェック
        if (userQuery.includes('新台')) {
            systemPrompt = `あなたはパチンコ・パチスロ店の優秀なセールスBOTです。ユーザーから新台について質問されています。以下の遊技機リストの中から、「type」が「pachinko」または「pachislot」である新台カテゴリの機種をいくつか選び、それらのセールストークをまとめて紹介してください。セールストークは必ず「お客様、」から始めて、機種ごとに改行して分かりやすく提示してください。\n\n遊技機リスト:\n${JSON.stringify(machineList, null, 2)}`;
        } else if (userQuery.includes('たけし')) {
            // 「たけし」が入力された場合の特別な応答
            return {
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: "ああ！くっさいカレーのことですね！\n八潮店にはカレーが生息しています！\nよければ食べに来てください！\nありがとうございます！" })
            };
        }
        else {
            // 通常の質問の場合の指示
            systemPrompt = `あなたはパチンコ・パチスロ店の優秀なセールスBOTです。ユーザーからの質問に対して、以下の遊技機リストの情報を基に、簡潔で魅力的なセールストークを生成してください。リストにない機種や、スペック以外の質問には答えられません。セールストークは必ず「お客様、」から始めてください。\n\n遊技機リスト:\n${JSON.stringify(machineList, null, 2)}`;
        }

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


