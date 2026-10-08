const HOUSE_NO_PATTERN = /^\d+[a-zA-Zא-ת]?$/;
const NAME_PATTERN = /^[\p{L}][\p{L}\s'״׳-]*$/u;

const RECIPIENT_NAME_FIELDS = new Set([
  'man',
  'woman',
  'lastName',
  'firstNameMan',
  'firstNameWoman',
]);

export function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === '';
}

export function isValidIsraeliPhone(phone) {
  return /^(05\d{8}|0[23489]\d{7})$/.test(String(phone ?? '').trim());
}

export function isValidGmail(email) {
  return /^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(String(email ?? '').trim());
}

export function isValidPersonName(name) {
  return NAME_PATTERN.test(String(name ?? '').trim());
}

export function isRecipientValueInvalid(field, value) {
  if (isBlank(value)) return false;
  const text = String(value).trim();

  if (field === 'houseNo') return !HOUSE_NO_PATTERN.test(text);
  if (RECIPIENT_NAME_FIELDS.has(field)) return !isValidPersonName(text);
  return false;
}

export function findInvalidRecipientCells(rows, fieldDefinitions) {
  const requiredFields = new Set(
    fieldDefinitions.filter((field) => field.isRequired).map((field) => field.technicalName)
  );

  return rows.flatMap((row) =>
    fieldDefinitions.flatMap(({ technicalName }) => {
      const value = row[technicalName];
      return requiredFields.has(technicalName) && isBlank(value)
        || isRecipientValueInvalid(technicalName, value)
        ? [{ id: row.id, field: technicalName }]
        : [];
    })
  );
}
