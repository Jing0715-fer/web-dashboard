import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import fs from 'fs';
import path from 'path';
import os from 'os';

// GET /api/llm-config - Get LLM configuration
export async function GET() {
  try {
    let config = await db.llmConfig.findUnique({ where: { id: 'default' } });
    if (!config) {
      config = await db.llmConfig.create({
        data: { id: 'default' },
      });
    }

    // For claude-code provider, refresh config from environment on each read
    // so that changes to env vars are automatically picked up
    if (config.provider === 'claude-code' && config.claudeCodeAuto) {
      const detected = detectClaudeCodeConfig();
      if (detected.found && detected.apiKey) {
        // Update with latest detected values
        await db.llmConfig.update({
          where: { id: 'default' },
          data: {
            apiKey: detected.apiKey,
            baseUrl: detected.baseUrl || 'https://api.anthropic.com',
            model: detected.model || 'claude-sonnet-4-20250514',
          },
        });
        config = await db.llmConfig.findUnique({ where: { id: 'default' } });
      }
    }

    // Mask the API key for security - only show last 4 chars
    const maskedConfig = {
      ...config!,
      apiKey: config!.apiKey
        ? '*'.repeat(Math.max(0, config!.apiKey.length - 4)) + config!.apiKey.slice(-4)
        : '',
      hasApiKey: !!config!.apiKey,
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
    const { provider, apiKey, baseUrl, model, claudeCodeAuto } = body;

    const updateData: Record<string, string | boolean> = {};

    if (provider !== undefined) updateData.provider = provider;
    if (baseUrl !== undefined) updateData.baseUrl = baseUrl;
    if (model !== undefined) updateData.model = model;
    if (claudeCodeAuto !== undefined) updateData.claudeCodeAuto = claudeCodeAuto;

    // Only update apiKey if it's not masked (user actually changed it)
    if (apiKey !== undefined) {
      const isMasked = apiKey.includes('*');
      if (!isMasked) {
        updateData.apiKey = apiKey;
      }
    }

    // For claude-code provider with auto-detect, read from environment
    if (provider === 'claude-code' && claudeCodeAuto) {
      const detected = detectClaudeCodeConfig();
      if (detected.found && detected.apiKey) {
        updateData.apiKey = detected.apiKey;
        updateData.baseUrl = detected.baseUrl || 'https://api.anthropic.com';
        updateData.model = detected.model || 'claude-sonnet-4-20250514';
      }
    }

    const config = await db.llmConfig.upsert({
      where: { id: 'default' },
      update: updateData,
      create: {
        id: 'default',
        provider: provider || 'zai',
        apiKey: (apiKey && !apiKey.includes('*')) ? apiKey : '',
        baseUrl: baseUrl || '',
        model: model || '',
        claudeCodeAuto: claudeCodeAuto || false,
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

    if (provider === 'claude-code') {
      // Claude Code uses Anthropic Messages API format
      if (!apiKey) {
        // Try to re-detect
        const detected = detectClaudeCodeConfig();
        if (detected.found && detected.apiKey) {
          return testAnthropicApi(detected.apiKey, detected.baseUrl, detected.model || 'claude-sonnet-4-20250514');
        }
        return NextResponse.json({
          success: false,
          provider,
          message: 'No Claude Code configuration found. Make sure ANTHROPIC_API_KEY is set or Claude Code CLI is configured.',
        }, { status: 200 });
      }
      return testAnthropicApi(apiKey, baseUrl, model || 'claude-sonnet-4-20250514');
    }

    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required for custom providers' }, { status: 400 });
    }

    if (provider === 'anthropic') {
      return testAnthropicApi(apiKey, baseUrl, model || 'claude-sonnet-4-20250514');
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

// Helper: Test Anthropic API
async function testAnthropicApi(apiKey: string, baseUrl: string, model: string) {
  const testUrl = baseUrl
    ? `${baseUrl.replace(/\/$/, '')}/v1/messages`
    : 'https://api.anthropic.com/v1/messages';

  const response = await fetch(testUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
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
      provider: 'anthropic',
      message: `Anthropic API returned ${response.status}: ${errorText.slice(0, 300)}`,
    }, { status: 200 });
  }

  const data = await response.json();
  const content = data.content?.[0]?.text;

  return NextResponse.json({
    success: true,
    provider: 'anthropic',
    message: `Connection successful. Model: ${model}. Response: ${content?.slice(0, 50)}`,
  });
}

// Helper: Detect Claude Code CLI configuration from env vars and config files
function detectClaudeCodeConfig(): {
  found: boolean;
  apiKey: string;
  baseUrl: string;
  model: string;
  source: string;
  details: string[];
} {
  const result = {
    found: false,
    apiKey: '',
    baseUrl: '',
    model: '',
    source: '',
    details: [] as string[],
  };

  const homeDir = os.homedir();

  // 1. Check environment variables (most reliable)
  const envApiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || '';
  const envBaseUrl = process.env.ANTHROPIC_BASE_URL || process.env.CLAUDE_BASE_URL || '';
  const envModel = process.env.CLAUDE_MODEL || process.env.ANTHROPIC_MODEL || '';

  if (envApiKey) {
    result.found = true;
    result.apiKey = envApiKey;
    result.source = 'environment';
    result.details.push(`API key found in ANTHROPIC_API_KEY/CLAUDE_API_KEY`);
    if (envBaseUrl) {
      result.baseUrl = envBaseUrl;
      result.details.push(`Base URL: ${envBaseUrl}`);
    }
    if (envModel) {
      result.model = envModel;
      result.details.push(`Model: ${envModel}`);
    }
  }

  // 2. Check ~/.claude/ directory for config files
  const claudeDir = path.join(homeDir, '.claude');
  if (fs.existsSync(claudeDir)) {
    // Check for settings.json
    const settingsPath = path.join(claudeDir, 'settings.json');
    if (fs.existsSync(settingsPath)) {
      try {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
        result.details.push(`Found ~/.claude/settings.json`);
        if (settings.apiKey && !result.apiKey) {
          result.apiKey = settings.apiKey;
          result.found = true;
          result.source = result.source || 'claude-settings';
        }
        if (settings.apiBaseUrl && !result.baseUrl) result.baseUrl = settings.apiBaseUrl;
        if (settings.model && !result.model) result.model = settings.model;
        // Nested api config
        if (settings.api?.key && !result.apiKey) {
          result.apiKey = settings.api.key;
          result.found = true;
          result.source = result.source || 'claude-settings';
        }
        if (settings.api?.baseUrl && !result.baseUrl) result.baseUrl = settings.api.baseUrl;
        if (settings.api?.model && !result.model) result.model = settings.api.model;
      } catch { /* ignore */ }
    }

    // Check for credentials
    const credPath = path.join(claudeDir, 'credentials.json');
    if (fs.existsSync(credPath)) {
      try {
        const cred = JSON.parse(fs.readFileSync(credPath, 'utf-8'));
        result.details.push(`Found ~/.claude/credentials.json`);
        if (cred.apiKey && !result.apiKey) {
          result.apiKey = cred.apiKey;
          result.found = true;
          result.source = result.source || 'claude-credentials';
        }
        if (cred.apiBaseUrl && !result.baseUrl) result.baseUrl = cred.apiBaseUrl;
      } catch { /* ignore */ }
    }

    // Check for .env file
    const envPath = path.join(claudeDir, '.env');
    if (fs.existsSync(envPath)) {
      try {
        const envVars = parseEnvFile(fs.readFileSync(envPath, 'utf-8'));
        result.details.push(`Found ~/.claude/.env`);
        if (envVars.ANTHROPIC_API_KEY && !result.apiKey) {
          result.apiKey = envVars.ANTHROPIC_API_KEY;
          result.found = true;
          result.source = result.source || 'claude-env';
        }
        if (envVars.CLAUDE_API_KEY && !result.apiKey) {
          result.apiKey = envVars.CLAUDE_API_KEY;
          result.found = true;
          result.source = result.source || 'claude-env';
        }
        if (envVars.ANTHROPIC_BASE_URL && !result.baseUrl) result.baseUrl = envVars.ANTHROPIC_BASE_URL;
        if (envVars.CLAUDE_MODEL && !result.model) result.model = envVars.CLAUDE_MODEL;
      } catch { /* ignore */ }
    }
  }

  // 3. Check ~/.claude.json (legacy)
  const claudeJsonPath = path.join(homeDir, '.claude.json');
  if (fs.existsSync(claudeJsonPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(claudeJsonPath, 'utf-8'));
      result.details.push(`Found ~/.claude.json`);
      if (config.apiKey && !result.apiKey) {
        result.apiKey = config.apiKey;
        result.found = true;
        result.source = result.source || 'claude-json';
      }
      if (config.apiBaseUrl && !result.baseUrl) result.baseUrl = config.apiBaseUrl;
      if (config.model && !result.model) result.model = config.model;
    } catch { /* ignore */ }
  }

  // 4. Check ~/.config/claude-code/
  const configDir = path.join(homeDir, '.config', 'claude-code');
  if (fs.existsSync(configDir)) {
    const configPath = path.join(configDir, 'config.json');
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        result.details.push(`Found ~/.config/claude-code/config.json`);
        if (config.apiKey && !result.apiKey) {
          result.apiKey = config.apiKey;
          result.found = true;
          result.source = result.source || 'claude-code-config';
        }
        if (config.apiBaseUrl && !result.baseUrl) result.baseUrl = config.apiBaseUrl;
        if (config.model && !result.model) result.model = config.model;
      } catch { /* ignore */ }
    }
  }

  // Defaults
  if (result.found && !result.model) {
    result.model = 'claude-sonnet-4-20250514';
    result.details.push('Using default model: claude-sonnet-4-20250514');
  }
  if (result.found && !result.baseUrl) {
    result.baseUrl = 'https://api.anthropic.com';
  }

  return result;
}

// Parse a simple .env file
function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}
