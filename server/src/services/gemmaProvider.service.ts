import { config } from '../config.js';
import { prisma } from '../db.js';
import { CustomerService } from './customer.service.js';
import { paiseToRupees, formatINR } from '../utils/currency.js';
import Groq from 'groq-sdk';

export interface GemmaProviderStatus {
  configured: boolean;
  provider: 'groq' | 'huggingface' | 'ollama' | 'custom' | 'unconfigured';
  model: string;
  status: 'ready' | 'unconfigured' | 'error';
  message: string;
  instructions: string;
  tools: string[];
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface StructuredPreview {
  actionType: 'TRANSACTION' | 'CUSTOMER';
  requiresConfirmation: true;
  data: any;
  summaryText: string;
}

export interface GemmaAssistantResponse {
  message: string;
  model: string;
  provider: string;
  preview?: StructuredPreview | null;
  toolResults?: any[];
  error?: string | null;
}

export class GemmaProviderService {
  private static readonly AVAILABLE_TOOLS = [
    'get_ledger_summary',
    'get_top_debtors',
    'get_today_collections',
    'get_recent_transactions',
    'get_customer_balance',
    'prepare_transaction_preview',
    'prepare_customer_preview',
  ];

  /**
   * Determine currently active Gemma provider
   */
  static getStatus(): GemmaProviderStatus {
    const model = config.gemmaModel || 'gemma2-9b-it';
    const tools = [...this.AVAILABLE_TOOLS];

    if (config.groqApiKey) {
      return {
        configured: true,
        provider: 'groq',
        model: model.includes('gemma') ? model : 'gemma2-9b-it',
        status: 'ready',
        message: 'Google Gemma 2 (9B Instruction-Tuned) active via Groq high-speed LPU inference.',
        instructions: 'Gemma 2 is powered by Groq API key.',
        tools,
      };
    }

    if (config.hfToken) {
      return {
        configured: true,
        provider: 'huggingface',
        model: model.startsWith('google/') ? model : `google/${model}`,
        status: 'ready',
        message: 'Google Gemma 2 active via Hugging Face Serverless Inference API.',
        instructions: 'Gemma 2 is powered by Hugging Face access token.',
        tools,
      };
    }

    if (config.gemmaApiBaseUrl) {
      const isOllama = config.gemmaApiBaseUrl.includes('localhost') || config.gemmaApiBaseUrl.includes('11434');
      return {
        configured: true,
        provider: isOllama ? 'ollama' : 'custom',
        model,
        status: 'ready',
        message: `Google Gemma 2 active via ${isOllama ? 'Local Ollama' : 'Custom Endpoint'} (${config.gemmaApiBaseUrl}).`,
        instructions: `Gemma 2 endpoint: ${config.gemmaApiBaseUrl}`,
        tools,
      };
    }

    return {
      configured: false,
      provider: 'unconfigured',
      model,
      status: 'unconfigured',
      message: 'Gemma open-weight model is not currently configured with an API key or local runner.',
      instructions:
        'To enable Google Gemma conversational AI:\n' +
        '1. Set GROQ_API_KEY in your .env (Free, no credit card required at https://console.groq.com)\n' +
        '2. OR set HF_TOKEN for Hugging Face Inference API\n' +
        '3. OR run locally via Ollama: "ollama run gemma2:2b" and set GEMMA_API_BASE_URL="http://localhost:11434/v1"',
      tools,
    };
  }

  /**
   * Main conversational assistant pipeline with backend-authorized tools
   */
  static async chat(
    userId: string,
    userPrompt: string,
    history: ChatMessage[] = []
  ): Promise<GemmaAssistantResponse> {
    const status = this.getStatus();

    // 1. If Gemma is unconfigured, provide transparent diagnostic response with exact ledger metrics
    if (!status.configured) {
      return this.handleUnconfiguredGemma(userId, userPrompt, status);
    }

    // 2. Load authenticated user's actual ledger context to empower Gemma tools
    try {
      if (status.provider === 'groq') {
        return await this.chatWithGroqGemma(userId, userPrompt, history, status);
      } else {
        return await this.chatWithOpenAICompatibleGemma(userId, userPrompt, history, status);
      }
    } catch (err: any) {
      console.error('[GemmaProvider] Model error:', err.message);
      // Fallback with graceful error reporting
      return {
        message: `Gemma model request failed (${err.message}). Showing your direct ledger query response below:`,
        model: status.model,
        provider: status.provider,
        error: err.message,
        preview: null,
      };
    }
  }

  /**
   * Groq-hosted Gemma 2 implementation with tool calling
   */
  private static async chatWithGroqGemma(
    userId: string,
    userPrompt: string,
    history: ChatMessage[],
    status: GemmaProviderStatus
  ): Promise<GemmaAssistantResponse> {
    const groq = new Groq({ apiKey: config.groqApiKey });

    // Define authorized tools
    const tools: any[] = [
      {
        type: 'function',
        function: {
          name: 'get_ledger_summary',
          description: 'Get total outstanding credit, total collections, total customer count, and overdue balances for this shop.',
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_top_debtors',
          description: 'Get list of customers who owe the most outstanding credit, sorted from highest to lowest.',
          parameters: {
            type: 'object',
            properties: {
              limit: { type: 'number', description: 'Number of customers to return (default 5)' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_today_collections',
          description: 'Get all payments recorded today with customer names, payment modes, and amounts.',
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_recent_transactions',
          description: 'Get recent credit and payment transactions recorded in the ledger.',
          parameters: {
            type: 'object',
            properties: {
              limit: { type: 'number', description: 'Number of transactions to return (default 5)' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_customer_balance',
          description: 'Lookup a specific customer by name to get their current outstanding balance, contact, and recent history.',
          parameters: {
            type: 'object',
            properties: {
              customerName: { type: 'string', description: 'Name of the customer to lookup' },
            },
            required: ['customerName'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'prepare_transaction_preview',
          description: 'Prepare a credit or payment transaction preview for user review. DOES NOT SAVE TO DATABASE.',
          parameters: {
            type: 'object',
            properties: {
              customerName: { type: 'string', description: 'Name of customer' },
              type: { type: 'string', enum: ['CREDIT', 'PAYMENT'], description: 'Credit (udhaar) or Payment received' },
              amountRupees: { type: 'number', description: 'Amount in Indian Rupees' },
              description: { type: 'string', description: 'Item name or payment note' },
              dueDate: { type: 'string', description: 'Optional due date in YYYY-MM-DD' },
            },
            required: ['customerName', 'type', 'amountRupees'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'prepare_customer_preview',
          description: 'Prepare a new customer registration preview for user review. DOES NOT SAVE TO DATABASE.',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Customer full name' },
              phone: { type: 'string', description: 'Mobile phone number' },
              notes: { type: 'string', description: 'Optional customer notes' },
              openingBalanceRupees: { type: 'number', description: 'Optional opening credit balance in Rupees' },
            },
            required: ['name'],
          },
        },
      },
    ];

    const systemPrompt = `You are TalkLedger's intelligent shop assistant, powered by Google Gemma 2 (Open Weights).
You help small business owners manage their bahi-khata (credit and payment ledger).
Guidelines:
1. Always use the authorized tools to fetch factual data. NEVER invent or hallucinate financial numbers.
2. Format all money with the Indian Rupee symbol (₹) and Indian numbering commas (e.g. ₹1,200, ₹50,000).
3. If the user asks to record a transaction or add a customer, use the "prepare_transaction_preview" or "prepare_customer_preview" tool. Inform the user that a preview has been prepared and that they must click Confirm to save it. NEVER claim you have saved it to the database yourself.
4. Keep answers friendly, professional, and culturally tailored to Indian retail merchants (kirana, tailors, tutors).
5. Be concise and structured.`;

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-6).map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: userPrompt },
    ];

    const modelName = status.model || 'gemma2-9b-it';

    const response = await groq.chat.completions.create({
      model: modelName,
      messages,
      tools,
      tool_choice: 'auto',
      temperature: 0.2,
      max_tokens: 1024,
    });

    const responseMessage = response.choices[0]?.message;
    if (!responseMessage) {
      throw new Error('Empty response from Gemma model');
    }

    // Check if Gemma called any tools
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      let preview: StructuredPreview | null = null;
      const toolResultsMessages: any[] = [];

      for (const call of responseMessage.tool_calls) {
        const fnName = call.function.name;
        const fnArgs = JSON.parse(call.function.arguments || '{}');

        const { result, generatedPreview } = await this.executeAuthorizedTool(userId, fnName, fnArgs);
        if (generatedPreview) preview = generatedPreview;

        toolResultsMessages.push({
          role: 'tool',
          tool_call_id: call.id,
          name: fnName,
          content: JSON.stringify(result),
        });
      }

      // Second round to formulate final user-facing text with tool outputs
      const secondResponse = await groq.chat.completions.create({
        model: modelName,
        messages: [
          ...messages,
          responseMessage,
          ...toolResultsMessages,
        ],
        temperature: 0.3,
        max_tokens: 1024,
      });

      return {
        message: secondResponse.choices[0]?.message?.content || 'Here are the details from your ledger:',
        model: modelName,
        provider: 'groq',
        preview,
      };
    }

    return {
      message: responseMessage.content || 'How can I assist you with your ledger today?',
      model: modelName,
      provider: 'groq',
      preview: null,
    };
  }

  /**
   * Generic OpenAI-compatible Gemma caller (Hugging Face, Ollama, or Custom)
   */
  private static async chatWithOpenAICompatibleGemma(
    userId: string,
    userPrompt: string,
    history: ChatMessage[],
    status: GemmaProviderStatus
  ): Promise<GemmaAssistantResponse> {
    const baseUrl = status.provider === 'huggingface'
      ? 'https://router.huggingface.co/hf-inference/v1'
      : config.gemmaApiBaseUrl || 'http://localhost:11434/v1';

    const apiKey = status.provider === 'huggingface' ? config.hfToken : 'dummy-key';

    // Extract quick context to embed in system prompt for models without native tool-calling
    const summary = await this.executeAuthorizedTool(userId, 'get_ledger_summary', {});
    const debtors = await this.executeAuthorizedTool(userId, 'get_top_debtors', { limit: 5 });

    const systemPrompt = `You are TalkLedger's intelligent assistant, powered by Google Gemma 2 (${status.model}).
Here is the live verified ledger data for this merchant:
- Total Outstanding Balance: ₹${summary.result.totalCreditRupees}
- Total Payments Collected: ₹${summary.result.totalPaymentsRupees}
- Active Customers: ${summary.result.totalCustomers}
- Top Customers with Outstanding Balance: ${JSON.stringify(debtors.result)}

Answer the merchant's query concisely using this verified data. Use ₹ and Indian number format. Never invent balances.`;

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: status.model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...history.slice(-4),
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 800,
      }),
    });

    if (!res.ok) {
      throw new Error(`Gemma endpoint (${status.provider}) returned status ${res.status}`);
    }

    const data: any = await res.json();
    const content = data.choices?.[0]?.message?.content || 'Query completed.';

    // Check if the user prompt was asking to add a customer or transaction
    const preview = await this.checkAndGeneratePreviewFromText(userId, userPrompt);

    return {
      message: content,
      model: status.model,
      provider: status.provider,
      preview,
    };
  }

  /**
   * Transparent response when Gemma is not configured
   */
  private static async handleUnconfiguredGemma(
    userId: string,
    userPrompt: string,
    status: GemmaProviderStatus
  ): Promise<GemmaAssistantResponse> {
    const lower = userPrompt.toLowerCase();

    // Answer direct queries factually while stating Gemma is unconfigured
    let contextualAnswer = '';
    let preview: StructuredPreview | null = null;

    if (lower.includes('who owes') || lower.includes('top debtor') || lower.includes('highest balance')) {
      const top = await this.executeAuthorizedTool(userId, 'get_top_debtors', { limit: 5 });
      contextualAnswer = `Here are your customers with the highest outstanding balances:\n` +
        top.result.map((c: any, i: number) => `${i + 1}. **${c.name}**: ${c.balanceFormatted}`).join('\n');
    } else if (lower.includes('today') || lower.includes('collected today')) {
      const today = await this.executeAuthorizedTool(userId, 'get_today_collections', {});
      contextualAnswer = `Today's collections total: **${today.result.totalTodayFormatted}** across ${today.result.count} payments.`;
    } else if (lower.includes('summary') || lower.includes('balance') || lower.includes('overview')) {
      const sum = await this.executeAuthorizedTool(userId, 'get_ledger_summary', {});
      contextualAnswer = `**Ledger Overview:**\n- Total Outstanding Credit: **${sum.result.totalCreditFormatted}**\n- Total Collected: **${sum.result.totalPaymentsFormatted}**\n- Customers: **${sum.result.totalCustomers}**`;
    } else {
      contextualAnswer = `You asked: "${userPrompt}".`;
      preview = await this.checkAndGeneratePreviewFromText(userId, userPrompt);
    }

    return {
      message:
        `${contextualAnswer}\n\n` +
        `> ℹ️ **Gemma Model Notice**: Google Gemma 2 open-weights model is unconfigured on this environment. To enable conversational AI, set \`GROQ_API_KEY\` (free at console.groq.com) or \`HF_TOKEN\` in your environment variables.`,
      model: status.model,
      provider: 'unconfigured',
      preview,
    };
  }

  /**
   * Backend-authorized tool execution
   */
  static async executeAuthorizedTool(
    userId: string,
    toolName: string,
    args: any
  ): Promise<{ result: any; generatedPreview?: StructuredPreview | null }> {
    switch (toolName) {
      case 'get_ledger_summary': {
        const customers = await CustomerService.listCustomers(userId);
        let totalCreditPaise = 0;
        let totalPaymentPaise = 0;
        let overdueCount = 0;

        for (const c of customers) {
          totalCreditPaise += c.totalCreditPaise;
          totalPaymentPaise += c.totalPaymentPaise;
          if (c.isOverdue) overdueCount++;
        }

        const netBalancePaise = totalCreditPaise - totalPaymentPaise;

        return {
          result: {
            totalCustomers: customers.length,
            netOutstandingPaise: netBalancePaise,
            netOutstandingRupees: paiseToRupees(netBalancePaise),
            totalCreditRupees: paiseToRupees(totalCreditPaise),
            totalPaymentsRupees: paiseToRupees(totalPaymentPaise),
            totalCreditFormatted: formatINR(totalCreditPaise),
            totalPaymentsFormatted: formatINR(totalPaymentPaise),
            overdueCustomers: overdueCount,
          },
        };
      }

      case 'get_top_debtors': {
        const limit = args.limit || 5;
        const customers = await CustomerService.listCustomers(userId);
        const debtors = customers
          .filter((c) => c.balancePaise > 0)
          .sort((a, b) => b.balancePaise - a.balancePaise)
          .slice(0, limit)
          .map((c) => ({
            id: c.id,
            name: c.name,
            phone: c.phone || 'No phone',
            balancePaise: c.balancePaise,
            balanceRupees: paiseToRupees(c.balancePaise),
            balanceFormatted: formatINR(c.balancePaise),
            isOverdue: c.isOverdue,
          }));

        return { result: debtors };
      }

      case 'get_today_collections': {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const txns = await prisma.transaction.findMany({
          where: {
            userId,
            type: 'PAYMENT',
            reversedAt: null,
            transactionDate: { gte: startOfDay },
          },
          include: { customer: { select: { name: true } } },
        });

        const totalTodayPaise = txns.reduce((acc, t) => acc + t.amountPaise, 0);

        return {
          result: {
            count: txns.length,
            totalTodayPaise,
            totalTodayRupees: paiseToRupees(totalTodayPaise),
            totalTodayFormatted: formatINR(totalTodayPaise),
            transactions: txns.map((t) => ({
              customerName: t.customer.name,
              amount: paiseToRupees(t.amountPaise),
              amountFormatted: formatINR(t.amountPaise),
              mode: t.paymentMode || 'CASH',
            })),
          },
        };
      }

      case 'get_recent_transactions': {
        const limit = args.limit || 5;
        const txns = await prisma.transaction.findMany({
          where: { userId, reversedAt: null },
          orderBy: { transactionDate: 'desc' },
          take: limit,
          include: { customer: { select: { name: true } } },
        });

        return {
          result: txns.map((t) => ({
            id: t.id,
            customerName: t.customer.name,
            type: t.type,
            amount: paiseToRupees(t.amountPaise),
            amountFormatted: formatINR(t.amountPaise),
            date: t.transactionDate.toISOString().split('T')[0],
            description: t.description,
          })),
        };
      }

      case 'get_customer_balance': {
        const nameQuery = (args.customerName || '').trim().toLowerCase();
        const customers = await CustomerService.listCustomers(userId);
        const match = customers.find((c) => c.name.toLowerCase().includes(nameQuery));

        if (!match) {
          return {
            result: {
              found: false,
              message: `Customer "${args.customerName}" was not found in your ledger.`,
            },
          };
        }

        return {
          result: {
            found: true,
            id: match.id,
            name: match.name,
            phone: match.phone,
            balancePaise: match.balancePaise,
            balanceRupees: paiseToRupees(match.balancePaise),
            balanceFormatted: formatINR(match.balancePaise),
            notes: match.notes,
            lastActivityDate: match.lastActivityDate,
          },
        };
      }

      case 'prepare_transaction_preview': {
        // Resolve customer
        const customers = await CustomerService.listCustomers(userId);
        const nameQuery = (args.customerName || '').trim().toLowerCase();
        const match = customers.find((c) => c.name.toLowerCase().includes(nameQuery));

        const preview: StructuredPreview = {
          actionType: 'TRANSACTION',
          requiresConfirmation: true,
          data: {
            customerId: match ? match.id : '',
            customerName: match ? match.name : args.customerName,
            type: args.type === 'PAYMENT' ? 'PAYMENT' : 'CREDIT',
            amount: Number(args.amountRupees) || 0,
            description: args.description || `${args.type === 'PAYMENT' ? 'Payment' : 'Credit'} entry`,
            dueDate: args.dueDate || undefined,
            source: 'VOICE',
          },
          summaryText: `${args.type === 'PAYMENT' ? 'Payment of' : 'Credit for'} ₹${args.amountRupees} to ${
            match ? match.name : args.customerName
          }`,
        };

        return {
          result: {
            status: 'PREVIEW_GENERATED',
            note: 'Transaction preview generated. Must be explicitly confirmed by user before saving.',
            customerFound: Boolean(match),
          },
          generatedPreview: preview,
        };
      }

      case 'prepare_customer_preview': {
        const preview: StructuredPreview = {
          actionType: 'CUSTOMER',
          requiresConfirmation: true,
          data: {
            name: args.name,
            phone: args.phone || '',
            notes: args.notes || '',
            openingBalancePaise: args.openingBalanceRupees ? Math.round(args.openingBalanceRupees * 100) : 0,
          },
          summaryText: `New customer: ${args.name} ${args.phone ? `(${args.phone})` : ''}`,
        };

        return {
          result: {
            status: 'PREVIEW_GENERATED',
            note: 'Customer preview generated. Must be explicitly confirmed by user before saving.',
          },
          generatedPreview: preview,
        };
      }

      default:
        return { result: { error: `Unknown tool: ${toolName}` } };
    }
  }

  /**
   * Helper to inspect user prompt for transaction/customer intent
   */
  private static async checkAndGeneratePreviewFromText(
    userId: string,
    prompt: string
  ): Promise<StructuredPreview | null> {
    const text = prompt.toLowerCase();

    // Check for add customer intent
    if (text.includes('add customer') || text.includes('new customer') || text.includes('create customer')) {
      const nameMatch = prompt.match(/(?:add|new|create)\s+customer\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
      if (nameMatch) {
        return {
          actionType: 'CUSTOMER',
          requiresConfirmation: true,
          data: { name: nameMatch[1].trim(), phone: '', notes: '' },
          summaryText: `Add Customer: ${nameMatch[1].trim()}`,
        };
      }
    }

    // Check for transaction intent
    const amountMatch = prompt.match(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d{1,2})?)\s*(?:rupees|rs)?/i);
    if (amountMatch && (text.includes('owes') || text.includes('paid') || text.includes('credit') || text.includes('bought'))) {
      const customers = await CustomerService.listCustomers(userId);
      const match = customers.find((c) => text.includes(c.name.toLowerCase()));
      const type = text.includes('paid') ? 'PAYMENT' : 'CREDIT';

      return {
        actionType: 'TRANSACTION',
        requiresConfirmation: true,
        data: {
          customerId: match?.id || '',
          customerName: match?.name || 'Customer',
          type,
          amount: parseFloat(amountMatch[1]),
          description: 'Conversational assistant entry',
        },
        summaryText: `${type === 'PAYMENT' ? 'Payment' : 'Credit'} ₹${amountMatch[1]} for ${match?.name || 'Customer'}`,
      };
    }

    return null;
  }
}

export const gemmaProvider = GemmaProviderService;
