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

        // 特別なキーワード「たけし」が入力された場合の固定レスポンス
        if (userQuery.includes('たけし')) {
            const takeshiResponse = `ああ！くっさいカレーのことですね！
八潮店にはカレーが生息しています！
よければ食べに来てください！
ありがとうございます！`;
            return {
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: takeshiResponse })
            };
        }
        
        // Netlifyの環境変数に設定したAPIキーを安全に取得
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            throw new Error("APIキーがNetlifyの環境変数に設定されていません。");
        }

        // --- ここからが新しいロジックです ---
        // ユーザーの質問に「新台」が含まれているかチェック
        const isNewMachineQuery = userQuery.includes('新台');
        let effectiveMachineList = machineList; // デフォルトは全機種リスト
        let additionalSystemInstruction = ''; // AIへの追加指示

        // 「新台」に関する質問だった場合の処理
        if (isNewMachineQuery) {
            // 'pachinko' と 'pachislot' typeを持つ機種（＝新台カテゴリ）のみに絞り込む
            effectiveMachineList = machineList.filter(m => m.type === 'pachinko' || m.type === 'pachislot');
            // AIへの指示を追加
            additionalSystemInstruction = '今回は新台に関する質問なので、必ずこの絞り込まれたリストからのみ回答を生成してください。';
        }
        // --- ここまで ---

        // AIへの指示書（システムプロンプト）を作成
        const systemPrompt = `あなたはパチンコ・パチスロ店の優秀なセールスBOTです。ユーザーからの質問に対して、以下の遊技機リストの情報を基に、簡潔で魅力的なセールストークを生成してください。リストにない機種や、スペック以外の質問には答えられません。セールストークは必ず「お客様、」から始めてください。${additionalSystemInstruction}\n\n遊技機リスト:\n${JSON.stringify(effectiveMachineList, null, 2)}`;

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

