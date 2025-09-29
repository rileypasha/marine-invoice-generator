type AnyRecord = Record<string, any>;

export interface NormalizedInvoiceData<TLineItem = AnyRecord> {
  primaryData: AnyRecord;
  scope: AnyRecord;
  lineItems: TLineItem[];
}

const parseMaybeJson = (value: unknown): unknown => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return value;
    }
    try {
      return JSON.parse(trimmed);
    } catch (error) {
      console.warn('Failed to parse JSON string when normalizing invoice data:', error);
      return value;
    }
  }
  return value;
};

const normalizeObject = (value: unknown): AnyRecord | null => {
  const parsed = parseMaybeJson(value);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return parsed as AnyRecord;
  }
  return null;
};

const normalizeArray = <T>(value: unknown): T[] => {
  const parsed = parseMaybeJson(value);
  return Array.isArray(parsed) ? (parsed as T[]) : [];
};

const extractLineItemsFromScope = <T>(scope: AnyRecord): T[] => {
  const potentialKeys = ['lineItems', 'line_items', 'services', 'items'];
  for (const key of potentialKeys) {
    if (key in scope) {
      const items = normalizeArray<T>(scope[key]);
      if (items.length) {
        return items;
      }
    }
  }
  return [];
};

export const gatherInvoiceData = <TLineItem = AnyRecord>(invoice: unknown): NormalizedInvoiceData<TLineItem> => {
  if (!invoice || typeof invoice !== 'object') {
    return { primaryData: {}, scope: {}, lineItems: [] };
  }

  const invoiceAny = invoice as AnyRecord;
  const rawDataCandidates = [
    invoiceAny.parsedData,
    invoiceAny.parsed_data,
    invoiceAny.data,
    parseMaybeJson(invoiceAny.serialized_data),
    parseMaybeJson(invoiceAny.serializedData),
  ];

  const dataCandidates = rawDataCandidates
    .map(normalizeObject)
    .filter((candidate): candidate is AnyRecord => Boolean(candidate));

  const primaryData = dataCandidates.length > 0 ? dataCandidates[0] : {};

  const scopeCandidates = [
    primaryData?.scope,
    ...dataCandidates.slice(1).map(candidate => candidate?.scope),
    invoiceAny.scope,
    parseMaybeJson(invoiceAny.scope_json),
    parseMaybeJson(invoiceAny.scopeJson),
  ]
    .map(normalizeObject)
    .filter((candidate): candidate is AnyRecord => Boolean(candidate));

  const fallbackLineItemSources: unknown[] = [];
  for (const candidate of dataCandidates) {
    fallbackLineItemSources.push(candidate?.lineItems, candidate?.line_items, candidate?.services);
  }

  fallbackLineItemSources.push(
    invoiceAny.lineItems,
    invoiceAny.line_items,
    invoiceAny.services
  );

  const defaultScope: AnyRecord = scopeCandidates.length > 0 ? scopeCandidates[0] : {};

  for (const scope of scopeCandidates) {
    const lineItems = extractLineItemsFromScope<TLineItem>(scope);
    if (lineItems.length) {
      return { primaryData, scope, lineItems };
    }
  }

  for (const source of fallbackLineItemSources) {
    const lineItems = normalizeArray<TLineItem>(source);
    if (lineItems.length) {
      return { primaryData, scope: defaultScope, lineItems };
    }
  }

  return { primaryData, scope: defaultScope, lineItems: [] };
};

