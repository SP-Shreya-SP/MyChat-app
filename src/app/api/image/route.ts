import { NextResponse } from 'next/server';

const HF_TOKEN = process.env.HUGGINGFACE_TOKEN;
const IMAGE_MODEL = 'black-forest-labs/FLUX.1-schnell';
const CHAT_MODEL = process.env.NEXT_PUBLIC_HF_MODEL || 'meta-llama/Llama-3.2-3B-Instruct';

export async function POST(req: Request) {
    if (!HF_TOKEN) {
        return NextResponse.json({ error: 'HF Token not configured' }, { status: 500 });
    }

    try {
        const { prompt } = await req.json();
        console.log('Original prompt:', prompt);

        // Step 1: Enhance the prompt using the LLM
        let enhancedPrompt = prompt;
        try {
            const chatResponse = await fetch(
                `https://router.huggingface.co/v1/chat/completions`,
                {
                    headers: {
                        Authorization: `Bearer ${HF_TOKEN}`,
                        'Content-Type': 'application/json',
                    },
                    method: 'POST',
                    body: JSON.stringify({
                        model: CHAT_MODEL,
                        messages: [
                            { role: 'system', content: 'You are an expert image prompt engineer. Expand the user simple prompt into a highly detailed, descriptive, and artistic prompt for FLUX.1. Focus on lighting, texture, atmosphere, and specific details like gender, clothing, and background. Keep the final prompt under 70 words. Respond ONLY with the enhanced prompt.' },
                            { role: 'user', content: prompt }
                        ],
                        max_tokens: 100,
                    }),
                }
            );

            if (chatResponse.ok) {
                const chatData = await chatResponse.json();
                enhancedPrompt = chatData.choices[0]?.message?.content?.trim() || prompt;
                console.log('Enhanced prompt:', enhancedPrompt);
            }
        } catch (e) {
            console.error('Prompt enhancement failed, using original:', e);
        }

        // Step 2: Generate the image with the enhanced prompt
        const response = await fetch(
            `https://router.huggingface.co/hf-inference/models/${IMAGE_MODEL}`,
            {
                headers: {
                    Authorization: `Bearer ${HF_TOKEN}`,
                    'Content-Type': 'application/json',
                },
                method: 'POST',
                body: JSON.stringify({ inputs: enhancedPrompt, options: { wait_for_model: true } }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('HF Image API Error:', response.status, errorText);
            return NextResponse.json({ error: `HF API Error: ${response.status}`, details: errorText }, { status: response.status });
        }

        console.log('Image generated successfully.');
        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const dataUrl = `data:image/webp;base64,${base64}`;

        return NextResponse.json({ url: dataUrl });

    } catch (error) {
        console.error('Internal Image API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
