export function decimalStringToCents(value: string): bigint {
  const normalized = value.trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error(`Invalid money amount: ${value}`);
  }

  const negative = normalized.startsWith('-');
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [wholePart, fractionPart = ''] = unsigned.split('.');
  const fraction = (fractionPart + '00').slice(0, 2);
  const cents = BigInt(wholePart) * 100n + BigInt(fraction);
  return negative ? -cents : cents;
}

export function centsToDecimalString(cents: bigint): string {
  const negative = cents < 0n;
  const absolute = negative ? -cents : cents;
  const whole = absolute / 100n;
  const fraction = absolute % 100n;
  const formatted = `${whole}.${fraction.toString().padStart(2, '0')}`;
  return negative ? `-${formatted}` : formatted;
}
