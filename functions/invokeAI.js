// This code runs securely in the cloud, not in the browser.
exports.handler = async function (event, context) {
    // 1. Get the secret API key from a secure environment variable.
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "API key is not configured on the server." }),
        };
    }

    // 2. Get the data sent from your Netflex app.
    const { conversation, settings } = JSON.parse(event.body);

    try {
        // 3. Make the secure API call to OpenRouter.
        // We need to import a fetch library for Node.js environment.
        const fetch = (await import('node-fetch')).default;
        
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: settings.model || "deepseek/deepseek-r1",
                messages: conversation,
                temperature: settings.temperature || 0.7,
                max_tokens: settings.maxTokens || 4096,
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || `API Error: ${response.status}`);
        }

        const responseData = await response.json();
        const aiResponse = responseData.choices[0]?.message?.content || "No response received.";

        // 4. Send the AI's answer back to the Netflex app.
        return {
            statusCode: 200,
            body: JSON.stringify({ aiResponse }),
        };

    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};