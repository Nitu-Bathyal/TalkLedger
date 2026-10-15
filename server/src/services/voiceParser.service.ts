import { prisma } from '../db.js';
import { config } from '../config.js';
import { VoiceParseResult, PaymentMode } from '../shared/types.js';
import { rupeesToPaise } from '../utils/currency.js';

export class VoiceParserService {
  /**
   * Main entrypoint: parses voice transcript into structured transaction suggestions
   */
  static async parseVoiceTranscript(userId: string, transcript: string): Promise<VoiceParseResult> {
    const cleanTranscript = transcript.trim();
    if (!cleanTranscript) {
      return {
        customerName: null,
        matchedCustomerId: null,
        transactionType: null,
        amount: null,
        amountPaise: null,
        description: null,
        dueDate: null,
        paymentMode: null,
        confidence: 'LOW',
        ambiguityIndicators: ['Empty transcript provided'],
        clarificationNeeded: true,
        clarificationReason: 'No speech was detected. Please speak clearly or type the transaction details.',
        rawTranscript: transcript,
      };
    }

    // Load user's actual customers to resolve against
    const userCustomers = await prisma.customer.findMany({
      where: { userId },
      select: { id: true, name: true, phone: true },
    });

    // If Gemini API key is configured, use LLM extraction with NLP fallback
    if (config.geminiApiKey) {
      try {
        const llmResult = await this.parseWithGemini(cleanTranscript, userCustomers);
        if (llmResult) {
          return llmResult;
        }
      } catch (err: any) {
        console.warn('[VoiceParser] Gemini LLM extraction failed, using built-in rule parser:', err.message);
      }
    }

    // Use built-in offline NLP parser
    return this.parseWithRuleEngine(cleanTranscript, userCustomers);
  }

  /**
   * Built-in rule-based NLP extraction engine
   */
  static parseWithRuleEngine(
    transcript: string,
    existingCustomers: Array<{ id: string; name: string; phone?: string | null }>
  ): VoiceParseResult {
    const text = transcript.toLowerCase();
    const ambiguityIndicators: string[] = [];

    // 1. Transaction Type Detection
    let transactionType: 'CREDIT' | 'PAYMENT' | null = null;
    const paymentKeywords = [
      'paid', 'pay', 'payment', 'cleared', 'settled', 'jama', 'received', 'wapas',
      'settlement', 'gave money', 'cash received', 'upi'
    ];
    const creditKeywords = [
      'bought', 'purchase', 'purchased', 'credit', 'udhaar', 'borrowed', 'owes',
      'supplies', 'fabric', 'ration', 'groceries', 'took', 'le gaya', 'outstanding'
    ];

    const hasPaymentKeyword = paymentKeywords.some((k) => new RegExp(`\\b${k}\\b`, 'i').test(text));
    const hasCreditKeyword = creditKeywords.some((k) => new RegExp(`\\b${k}\\b`, 'i').test(text));

    if (hasPaymentKeyword && !hasCreditKeyword) {
      transactionType = 'PAYMENT';
    } else if (hasCreditKeyword && !hasPaymentKeyword) {
      transactionType = 'CREDIT';
    } else if (hasPaymentKeyword && hasCreditKeyword) {
      // Prioritize "paid" if phrase starts or explicitly states paid
      if (text.includes('paid') || text.includes('payment received')) {
        transactionType = 'PAYMENT';
      } else {
        transactionType = 'CREDIT';
      }
    } else {
      ambiguityIndicators.push('Transaction type (Credit vs Payment) was not clearly stated.');
    }

    // 2. Amount Extraction (Numeric digits or currency symbols)
    let extractedAmount: number | null = null;

    // Pattern 1: ₹340, Rs. 500, Rs 1200, 340 rupees, worth 340
    const currencyMatches = transcript.match(/(?:(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?)\s*(?:rupees?|rs\.?|inr))/i);
    if (currencyMatches) {
      const numStr = (currencyMatches[1] || currencyMatches[2]).replace(/,/g, '');
      const parsed = parseFloat(numStr);
      if (!isNaN(parsed) && parsed > 0) {
        extractedAmount = parsed;
      }
    }

    // Pattern 2: "worth 340", "amount 500", "for 1200" or standalone numbers
    if (extractedAmount === null) {
      const standaloneNum = transcript.match(/\b(?:worth|amount|of|for)?\s*([\d,]+(?:\.\d{1,2})?)\b/i);
      if (standaloneNum) {
        const numStr = standaloneNum[1].replace(/,/g, '');
        const parsed = parseFloat(numStr);
        if (!isNaN(parsed) && parsed > 0) {
          extractedAmount = parsed;
        }
      }
    }

    // Pattern 3: English number words ("five hundred", "one thousand two hundred")
    if (extractedAmount === null) {
      extractedAmount = this.parseWordAmount(text);
    }

    if (extractedAmount === null) {
      ambiguityIndicators.push('Transaction amount could not be detected with confidence.');
    }

    // 3. Customer Matching against User Database
    let matchedCustomerId: string | null = null;
    let customerName: string | null = null;
    const candidates: Array<{ id: string; name: string; phone?: string | null; balancePaise: number }> = [];

    for (const cust of existingCustomers) {
      const custLower = cust.name.toLowerCase();
      const parts = custLower.split(/\s+/);
      const firstName = parts[0];

      // Exact full name in text
      if (text.includes(custLower)) {
        candidates.unshift({ id: cust.id, name: cust.name, phone: cust.phone, balancePaise: 0 });
      }
      // First name match with word boundary
      else if (firstName.length >= 3 && new RegExp(`\\b${firstName}\\b`, 'i').test(text)) {
        candidates.push({ id: cust.id, name: cust.name, phone: cust.phone, balancePaise: 0 });
      }
    }

    if (candidates.length === 1) {
      matchedCustomerId = candidates[0].id;
      customerName = candidates[0].name;
    } else if (candidates.length > 1) {
      // Check if one is a full match
      const exact = candidates.find((c) => text.includes(c.name.toLowerCase()));
      if (exact) {
        matchedCustomerId = exact.id;
        customerName = exact.name;
      } else {
        ambiguityIndicators.push(`Multiple customers matched: ${candidates.map((c) => c.name).join(', ')}.`);
        customerName = candidates[0].name;
      }
    } else {
      // Extract hypothetical name from phrases like "Aarav Sharma bought..." or "...from Ramesh Kumar"
      const extractedExtName = this.extractNameFromPhrase(transcript);
      if (extractedExtName) {
        customerName = extractedExtName;
        ambiguityIndicators.push(`"${extractedExtName}" is not yet registered in your customer ledger.`);
      } else {
        ambiguityIndicators.push('Customer name could not be identified from speech.');
      }
    }

    // 4. Payment Mode Detection
    let paymentMode: PaymentMode | null = null;
    if (text.includes('upi') || text.includes('gpay') || text.includes('phonepe') || text.includes('paytm')) {
      paymentMode = 'UPI';
    } else if (text.includes('cash') || text.includes('nagad')) {
      paymentMode = 'CASH';
    } else if (text.includes('bank') || text.includes('transfer') || text.includes('neft')) {
      paymentMode = 'BANK_TRANSFER';
    } else if (transactionType === 'PAYMENT') {
      paymentMode = 'CASH'; // Default to cash for small business payments
    }

    // 5. Due Date Extraction
    const dueDate = this.extractDueDate(text);

    // 6. Description / Items Extraction
    const description = this.extractDescription(transcript, customerName, extractedAmount);

    // 7. Calculate Confidence & Clarification Reason
    const clarificationNeeded = ambiguityIndicators.length > 0 || !matchedCustomerId || !extractedAmount || !transactionType;
    let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'HIGH';
    if (clarificationNeeded) {
      confidence = (!extractedAmount || !transactionType) ? 'LOW' : 'MEDIUM';
    }

    let clarificationReason: string | null = null;
    if (clarificationNeeded) {
      clarificationReason = ambiguityIndicators.join(' ') || 'Please review the extracted values before saving.';
    }

    return {
      customerName,
      matchedCustomerId,
      customerCandidates: candidates,
      transactionType,
      amount: extractedAmount,
      amountPaise: extractedAmount ? rupeesToPaise(extractedAmount) : null,
      description,
      dueDate,
      paymentMode,
      confidence,
      ambiguityIndicators,
      clarificationNeeded,
      clarificationReason,
      rawTranscript: transcript,
    };
  }

  /**
   * Helper to parse verbal English numbers
   */
  private static parseWordAmount(text: string): number | null {
    const wordMap: Record<string, number> = {
      one: 1, two: 2, three: 3, four: 4, five: 5,
      six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
      twenty: 20, thirty: 30, forty: 40, fifty: 50,
      sixty: 60, seventy: 70, eighty: 80, ninety: 90,
      hundred: 100, thousand: 1000,
    };

    const tokens = text.toLowerCase().split(/\s+/);
    let total = 0;
    let current = 0;
    let found = false;

    for (const token of tokens) {
      if (wordMap[token]) {
        found = true;
        const val = wordMap[token];
        if (val === 100 || val === 1000) {
          current = (current === 0 ? 1 : current) * val;
        } else {
          current += val;
        }
      } else if (found) {
        total += current;
        current = 0;
      }
    }
    total += current;

    return (found && total > 0) ? total : null;
  }

  /**
   * Extract potential customer name from common sentence patterns
   */
  private static extractNameFromPhrase(text: string): string | null {
    // e.g. "Record payment from Aarav Sharma" or "Aarav Sharma bought..."
    const patterns = [
      /(?:from|for|to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/,
      /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:bought|owes|has|purchased|paid|received)/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return null;
  }

  /**
   * Extract relative or explicit due dates
   */
  private static extractDueDate(text: string): string | null {
    const today = new Date();

    if (text.includes('tomorrow') || text.includes('kal')) {
      const d = new Date(today);
      d.setDate(d.getDate() + 1);
      return d.toISOString().split('T')[0];
    }

    if (text.includes('next week')) {
      const d = new Date(today);
      d.setDate(d.getDate() + 7);
      return d.toISOString().split('T')[0];
    }

    // "next Friday", "next Monday", etc.
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    for (let i = 0; i < days.length; i++) {
      if (text.includes(`next ${days[i]}`) || text.includes(days[i])) {
        const currentDay = today.getDay();
        let targetDay = i;
        let diff = targetDay - currentDay;
        if (diff <= 0) diff += 7;
        const d = new Date(today);
        d.setDate(d.getDate() + diff);
        return d.toISOString().split('T')[0];
      }
    }

    return null;
  }

  /**
   * Clean description from transcript
   */
  private static extractDescription(transcript: string, name: string | null, _amount: number | null): string {
    let desc = transcript;
    if (name) {
      desc = desc.replace(new RegExp(name, 'gi'), '');
    }
    // Remove boilerplate words
    desc = desc.replace(/\b(record|payment|bought|credit|rupees?|rs\.?|inr|worth|paid|has|owes|next friday|tomorrow)\b/gi, '').trim();
    // Remove digits and symbols
    desc = desc.replace(/[₹\d,.]+/g, '').replace(/\s{2,}/g, ' ').trim();
    return desc.length > 2 ? desc.charAt(0).toUpperCase() + desc.slice(1) : 'Voice entry';
  }

  /**
   * Optional Gemini LLM Extraction
   */
  private static async parseWithGemini(
    transcript: string,
    existingCustomers: Array<{ id: string; name: string; phone?: string | null }>
  ): Promise<VoiceParseResult | null> {
    const customerListStr = existingCustomers.map((c) => `"${c.name}" (ID: ${c.id})`).join(', ');

    const prompt = `You are TalkLedger's financial entity extractor for Indian small businesses.
Analyze this spoken sentence: "${transcript}"

Existing Registered Customers in Ledger: [${customerListStr}]

Extract the following JSON strictly conforming to this schema:
{
  "customerName": string or null (name of the customer mentioned),
  "matchedCustomerId": string or null (matching ID from the registered list above, or null if unknown),
  "transactionType": "CREDIT" | "PAYMENT" | null,
  "amount": number or null (positive value in Rupees, e.g. 340),
  "description": string or null (item or purpose, e.g. "Groceries"),
  "dueDate": string or null (in YYYY-MM-DD format if mentioned, e.g. "next Friday", otherwise null),
  "paymentMode": "CASH" | "UPI" | "BANK_TRANSFER" | null,
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "ambiguityIndicators": string[],
  "clarificationNeeded": boolean,
  "clarificationReason": string or null
}
Return only raw JSON.`;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${config.geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    });

    if (!res.ok) {
      throw new Error(`Gemini API returned status ${res.status}`);
    }

    const data: any = await res.json();
    const rawJsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawJsonText) return null;

    const parsed = JSON.parse(rawJsonText);
    return {
      ...parsed,
      amountPaise: parsed.amount ? rupeesToPaise(parsed.amount) : null,
      rawTranscript: transcript,
    };
  }
}
