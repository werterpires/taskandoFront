export function today(): Date {
  const today = new Date();
  return today;
}

export function DateToLocalDate(date: Date): string {
  date.setDate(date.getDate() + 1);

  const day = date.getDate();

  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return `${day < 10 ? '0' + day : day}/${
    month < 10 ? '0' + month : month
  }/${year}`;
}

export function isValidDate(dateString: string | undefined): boolean {
  if (!dateString) return false;
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) return false;
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

export function turnUndefinedIfEmpty(value: any) {
  if (typeof value === 'string' && value.length === 0) return undefined;
  if (typeof value === 'number' && value === 0) return undefined;
  return value;
}
