export interface PaymentDetails {
  upiId: string;
  payeeName: string;
  amount: number;
  transactionNote: string;
  month: string;
  year: number;
}

export interface PaymentService {
  generatePaymentLink(details: PaymentDetails): string;
  openPayment(details: PaymentDetails): void;
}

class UPIPaymentService implements PaymentService {
  generatePaymentLink(details: PaymentDetails): string {
    const params = new URLSearchParams({
      pa: details.upiId,
      pn: details.payeeName,
      am: details.amount.toString(),
      tn: `${details.transactionNote} - ${details.month} ${details.year}`,
      cu: 'INR',
    });
    return `upi://pay?${params.toString()}`;
  }

  openPayment(details: PaymentDetails): void {
    const link = this.generatePaymentLink(details);
    const anchor = document.createElement('a');
    anchor.href = link;
    anchor.rel = 'noopener noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }
}

export const paymentService: PaymentService = new UPIPaymentService();

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
