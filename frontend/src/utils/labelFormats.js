const MM_TO_PX = 96 / 25.4;

export const DEFAULT_CUSTOM_LABEL_FORMAT = {
  pageWidthMm: 210,
  pageHeightMm: 297,
  labelWidthMm: 70,
  labelHeightMm: 26,
  topMarginMm: 10,
  rightMarginMm: 0,
  bottomMarginMm: 10,
  leftMarginMm: 0,
  horizontalGapMm: 0,
  verticalGapMm: 0,
};

const FORMAT_FIELDS = Object.keys(DEFAULT_CUSTOM_LABEL_FORMAT);

export function normalizeCustomLabelFormat(format) {
  if (!format || typeof format !== 'object') return null;
  const values = Object.fromEntries(
    FORMAT_FIELDS.map((field) => [field, Number(format[field])]),
  );
  if (Object.values(values).some((value) => !Number.isFinite(value))) return null;

  const {
    pageWidthMm,
    pageHeightMm,
    labelWidthMm,
    labelHeightMm,
    topMarginMm,
    rightMarginMm,
    bottomMarginMm,
    leftMarginMm,
    horizontalGapMm,
    verticalGapMm,
  } = values;
  if (
    pageWidthMm <= 0 || pageHeightMm <= 0 || labelWidthMm <= 0 || labelHeightMm <= 0
    || [topMarginMm, rightMarginMm, bottomMarginMm, leftMarginMm, horizontalGapMm, verticalGapMm]
      .some((value) => value < 0)
  ) return null;

  const availableWidth = pageWidthMm - leftMarginMm - rightMarginMm;
  const availableHeight = pageHeightMm - topMarginMm - bottomMarginMm;
  const columns = Math.floor((availableWidth + horizontalGapMm) / (labelWidthMm + horizontalGapMm));
  const rows = Math.floor((availableHeight + verticalGapMm) / (labelHeightMm + verticalGapMm));
  if (columns < 1 || rows < 1) return null;

  return { ...values, columns, rows };
}

export function getCustomLabelLayout(format) {
  const normalized = normalizeCustomLabelFormat(format);
  if (!normalized) return null;
  return {
    ...normalized,
    width: normalized.labelWidthMm * MM_TO_PX,
    height: normalized.labelHeightMm * MM_TO_PX,
    horizontalGap: normalized.horizontalGapMm * MM_TO_PX,
    verticalGap: normalized.verticalGapMm * MM_TO_PX,
  };
}

export function isValidCustomLabelFormat(format) {
  return normalizeCustomLabelFormat(format) !== null;
}
