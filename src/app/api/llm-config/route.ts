import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/llm-config - Get LLM configuration
export async function GET() {
  try {
    let config = await db.llmConfig.findUnique({ where: { id: 'default' } });
    if (!config) {
      config = await db.llmConfig.create({
        data: { id: 'default' },
      });
    }
    // Mask the API key for security - only show last 4 chars
    const maskedConfig = {
      ...config,
      apiKey: config.apiKey
        ? '*'.repeat(Math.max(0, config.apiKey.length - 4)) + config.apiKey.slice(-4)
        : '',
      hasApiKey: !!config.apiKey,
    };
    return NextResponse.json({ config: maskedConfig });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PUT /api/llm-config - Update LLM configuration
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { provider, apiKey, baseUrl, model } = body;

    // Get existing config to check if apiKey is masked (unchanged)
    const existing = await db.llmConfig.findUnique({ where: { id: 'default' } });

    const updateData: Record<string, string> = {};

    if (provider !== undefined) updateData.provider = provider;
    if (baseUrl !== undefined) updateData.baseUrl = baseUrl;
    if (model !== undefined) updateData.model = model;

    // Only update apiKey if it's not masked (user actually changed it)
    if (apiKey !== undefined) {
      const isMasked = apiKey.includes('*');
      if (!isMasked) {
        updateData.apiKey = apiKey;
      }
      // If masked, keep the existing apiKey
    }

    const config = await db.llmConfig.upsert({
      where: { id: 'default' },
      update: updateData,
      create: {
        id: 'default',
        provider: provider || 'zai',
        apiKey: apiKey && !apiKey.includes('*') ? apiKey : '',
        baseUrl: baseUrl || '',
        model: model || '',
      },
    });

    const maskedConfig = {
      ...config,
      apiKey: config.apiKey
        ? '*'.repeat(Math.max(0, config.apiKey.length - 4)) + config.apiKey.slice(-4)
        : '',
      hasApiKey: !!config.apiKey,
    };

    return NextResponse.json({ config: maskedConfig });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/llm-config - Test LLM connection
export async function POST() {
  try {
    const config = await db.llmConfig.findUnique({ where: { id: 'default' } });

    if (!config) {
      return NextResponse.json({ error: 'No LLM configuration found' }, { status: 404 });
    }

    const { provider, apiKey, baseUrl, model } = config;

    if (provider === 'zai') {
      // Test z-ai-web-dev-sdk
      const ZAI = (await import('z-ai-web-dev-sdk')).default;
      const zai = await ZAI.create();
      const completion = await zai.chat.completions.create({
        messages: [
          { role: 'assistant', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Say "OK" and nothing else.' },
        ],
        thinking: { type: 'disabled' },
      });
      const response = completion.choices[0]?.message?.content;
      return NextResponse.json({
        success: true,
        provider: 'zai',
        message: `Connection successful. Response: ${response?.slice(0, 50)}`,
      });
    }

    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required for custom providers' }, { status: 400 });
    }

    if (provider === 'anthropic') {
      // Test Anthropic API (Messages API format)
      const testUrl = baseUrl
        ? `${baseUrl.replace(/\/$/, '')}/v1/messages`
        : 'https://api.anthropic.com/v1/messages';
      const testModel = model || 'claude-sonnet-4-20250514';

      const response = await fetch(testUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: testModel,
          max_tokens: 10,
          messages: [
            { role: 'user', content: 'Say "OK" and nothing else.' },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return NextResponse.json({
          success: false,
          provider,
          message: `Anthropic API returned ${response.status}: ${errorText.slice(0, 300)}`,
        }, { status: 200 });
      }

      const data = await response.json();
      const content = data.content?.[0]?.text;

      return NextResponse.json({
        success: true,
        provider: 'anthropic',
        message: `Connection successful. Model: ${testModel}. Response: ${content?.slice(0, 50)}`,
      });
    }

    // Test custom OpenAI-compatible API (also handles provider === 'openai')
    const testUrl = baseUrl
      ? `${baseUrl.replace(/\/$/, '')}/v1/chat/completions`
      : 'https://api.openai.com/v1/chat/completions';

    const testModel = model || 'gpt-4o-mini';

    const response = await fetch(testUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: testModel,
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Say "OK" and nothing else.' },
        ],
        max_tokens: 10,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({
        success: false,
        provider,
        message: `API returned ${response.status}: ${errorText.slice(0, 200)}`,
      }, { status: 200 });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    return NextResponse.json({
      success: true,
      provider,
      message: `Connection successful. Model: ${testModel}. Response: ${content?.slice(0, 50)}`,
    });
  } catch (e: any) {
    return NextResponse.json({
      success: false,
      message: e.message,
    }, { status: 200 });
  }
}
