import { NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');

    if (!query) {
        return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    try {
        console.log(`[Search] Fast Fetch: ${query}`);
        const response = await axios.get(`https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
            timeout: 5000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
            }
        });

        const $ = cheerio.load(response.data);
        const results: { title: string; link: string; snippet: string }[] = [];

        $('.result__a').each((i, el) => {
            if (i < 5) {
                const title = $(el).text().trim();
                const link = $(el).attr('href') || '';
                const snippet = $(el).closest('.result').find('.result__snippet').text().trim();
                if (title && link) {
                    results.push({ title, link, snippet });
                }
            }
        });

        console.log(`[Search] Fast search found ${results.length} results`);
        return NextResponse.json({
            results,
            status: results.length > 0 ? 'success' : 'no_results_found'
        });
    } catch (error: any) {
        console.warn('[Search] Timeout or blocked, falling back to AI knowledge.');
        return NextResponse.json({ results: [], status: 'timeout' });
    }
}
