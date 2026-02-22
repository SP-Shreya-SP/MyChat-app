import { NextResponse } from 'next/server';

const HF_TOKEN = process.env.HUGGINGFACE_TOKEN;
const HF_MODEL = process.env.NEXT_PUBLIC_HF_MODEL || 'meta-llama/Llama-3.2-3B-Instruct';

export async function POST(req: Request) {
    if (!HF_TOKEN) {
        return NextResponse.json({ error: 'HF Token not configured' }, { status: 500 });
    }

    try {
        const { messages } = await req.json();

        // Robust filtering to avoid 400 errors from empty content
        const filteredMessages = messages.filter((m: any) => m.content && m.content.trim() !== '');

        console.log(`[Chat] Payload to ${HF_MODEL}: ${JSON.stringify(filteredMessages, null, 2).slice(0, 500)}...`);

        const response = await fetch(
            `https://router.huggingface.co/v1/chat/completions`,
            {
                headers: {
                    'Authorization': `Bearer ${HF_TOKEN}`,
                    'Content-Type': 'application/json',
                },
                method: 'POST',
                body: JSON.stringify({
                    model: HF_MODEL,
                    messages: filteredMessages,
                    max_tokens: 1000,
                    stream: true,
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Chat] HF Error ${response.status}:`, errorText);
            return NextResponse.json({ error: 'Failed to fetch from Hugging Face', details: errorText }, { status: response.status });
        }

        console.log('[Chat] HF response OK, starting stream...');

        return new Response(response.body, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });

    } catch (error: any) {
        console.error('[Chat] API crash:', error);
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}
