export type BusinessOwnerFieldErrors = {
  phone?: string;
  vatNumber?: string;
  tinNumber?: string;
  ownerNationalId?: string;
};

export const PHONE_NUMBER_EXAMPLE = "+263 788 777 439";
export const VAT_NUMBER_EXAMPLE = "220025470";
export const TIN_NUMBER_EXAMPLE = "2000017533";
export const OWNER_NATIONAL_ID_EXAMPLE = "63-456789-B-34";

const ZIMBABWE_PHONE_NUMBER_PATTERN = /^\+263 \d{3} \d{3} \d{3}$/;
const VAT_NUMBER_PATTERN = /^\d{9}$/;
const TIN_NUMBER_PATTERN = /^\d{10}$/;
const OWNER_NATIONAL_ID_PATTERN = /^\d{2}-\d{6}-[A-Z]-\d{2}$/;

export const formatPhoneNumber = (value: string) => {
  const digitsOnly = value.replace(/\D/g, "");
  if (digitsOnly.length === 12 && digitsOnly.startsWith("263")) {
    return `+263 ${digitsOnly.slice(3, 6)} ${digitsOnly.slice(6, 9)} ${digitsOnly.slice(9, 12)}`;
  }

  return value.trim().replace(/\s+/g, " ");
};

export const normalizeOwnerNationalId = (value: string) =>
  value.toUpperCase().replace(/\s+/g, "").replace(/[^0-9A-Z-]/g, "");

export const validatePhoneNumber = (value: string) => {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return "Phone number is required.";
  }

  const digitsOnly = trimmedValue.replace(/\D/g, "");
  if (digitsOnly.length > 12) {
    return `Phone number is too long. Use ${PHONE_NUMBER_EXAMPLE}.`;
  }

  if (!ZIMBABWE_PHONE_NUMBER_PATTERN.test(trimmedValue)) {
    return `Phone number must use the format ${PHONE_NUMBER_EXAMPLE}.`;
  }

  return undefined;
};

export const validateVatNumber = (value: string) => {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return "VAT number is required.";
  }

  if (!VAT_NUMBER_PATTERN.test(trimmedValue)) {
    return `VAT number must contain exactly 9 digits, for example ${VAT_NUMBER_EXAMPLE}.`;
  }

  return undefined;
};

export const validateTinNumber = (value: string) => {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return "TIN number is required.";
  }

  if (!TIN_NUMBER_PATTERN.test(trimmedValue)) {
    return `TIN number must contain exactly 10 digits, for example ${TIN_NUMBER_EXAMPLE}.`;
  }

  return undefined;
};

export const validateOwnerNationalId = (value: string) => {
  const normalizedValue = normalizeOwnerNationalId(value);
  if (!normalizedValue) {
    return "Owner national ID is required.";
  }

  if (!OWNER_NATIONAL_ID_PATTERN.test(normalizedValue)) {
    return `Owner national ID must use the format ${OWNER_NATIONAL_ID_EXAMPLE}.`;
  }

  return undefined;
};

export const validateBusinessOwnerFields = ({
  phoneNumber,
  vatNumber,
  tinNumber,
  ownerNationalId,
}: {
  phoneNumber: string;
  vatNumber: string;
  tinNumber: string;
  ownerNationalId: string;
}) => {
  const errors: BusinessOwnerFieldErrors = {};
  const phoneError = validatePhoneNumber(phoneNumber);
  const vatNumberError = validateVatNumber(vatNumber);
  const tinNumberError = validateTinNumber(tinNumber);
  const ownerNationalIdError = validateOwnerNationalId(ownerNationalId);

  if (phoneError) {
    errors.phone = phoneError;
  }

  if (vatNumberError) {
    errors.vatNumber = vatNumberError;
  }

  if (tinNumberError) {
    errors.tinNumber = tinNumberError;
  }

  if (ownerNationalIdError) {
    errors.ownerNationalId = ownerNationalIdError;
  }

  return errors;
};
