import { ValidationErrors } from '@angular/forms';
import * as utils from '../../services/utils/utils.functions';

export function cpfMask() {
  return (value: string): string | null => {
    value = value.replace(/\D/g, '');
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    return value;
  };
}
