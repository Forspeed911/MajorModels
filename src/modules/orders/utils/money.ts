const MONEY_RE = /^-?\d+(?:\.\d{1,2})?$/;

export function decimalStringToCents(value: string): bigint {
  if (!MONEY_RE.test(value)) {
    throw new Error(`Invalid monetary value: ${value}`);
  }

  const sign = value.startsWith('-') ? -1n : 1n;
  const normalized = value.startsWith('-') ? value.slice(1) : value;
  const [whole, fraction = ''] = normalized.split('.');
  const fractionPadded = (fraction + '00').slice(0, 2);

  const cents = BigInt(whole) * 100n + BigInt(fractionPadded);
  return cents * sign;
}

export function centsToDecimalString(cents: bigint): string {
  const sign = cents < 0n ? '-' : '';
  const absolute = cents < 0n ? -cents : cents;
  const whole = absolute / 100n;
  const fraction = absolute % 100n;

  return `${sign}${whole.toString()}.${fraction.toString().padStart(2, '0')}`;
}
