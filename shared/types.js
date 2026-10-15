"use strict";
/**
 * TalkLedger — Shared Types & Enums
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.rupeesToPaise = rupeesToPaise;
exports.paiseToRupees = paiseToRupees;
exports.formatINR = formatINR;
/**
 * Currency and financial math utilities
 */
function rupeesToPaise(rupees) {
    const num = typeof rupees === 'string' ? parseFloat(rupees) : rupees;
    if (isNaN(num) || !isFinite(num)) {
        throw new Error('Invalid rupee amount');
    }
    return Math.round(num * 100);
}
function paiseToRupees(paise) {
    return paise / 100;
}
function formatINR(paise, options) {
    const rupees = paise / 100;
    const isNegative = rupees < 0;
    const absRupees = Math.abs(rupees);
    // Format with Indian numbering system
    const hasDecimal = options?.showPaise || (paise % 100 !== 0);
    const formatted = absRupees.toLocaleString('en-IN', {
        minimumFractionDigits: hasDecimal ? 2 : 0,
        maximumFractionDigits: 2,
    });
    return `${isNegative ? '-' : ''}₹${formatted}`;
}
