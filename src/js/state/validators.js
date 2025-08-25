export function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePhone(phone) {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length === 10;
}

export function validateNumber(value, min = 0) {
  const num = parseFloat(value);
  return !isNaN(num) && num >= min;
}

export function validateRequired(value) {
  return value && value.trim().length > 0;
}

export function validateLineItem(lineItem) {
  const errors = [];
  
  if (!lineItem.jobType) {
    errors.push('Job type is required');
  }
  
  if (lineItem.jobType === 'Manual Entry') {
    if (!lineItem.itemType) {
      errors.push('Item type is required for manual entry');
    }
    if (!validateNumber(lineItem.manualCost, 0)) {
      errors.push('Valid cost is required');
    }
  }
  
  if (lineItem.jobType === 'Agent Services') {
    const hasRegular = validateNumber(lineItem.laborHours, 0) && lineItem.laborHours > 0;
    const hasOT = validateNumber(lineItem.otHours, 0) && lineItem.otHours > 0;
    
    if (!hasRegular && !hasOT) {
      errors.push('Either regular or OT hours are required');
    }
  }
  
  if (!validateRequired(lineItem.description)) {
    errors.push('Description is required');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}