import TransactionListPage from '../../components/transactions/TransactionListPage';

export default function PurchaseListPage() {
  return (
    <TransactionListPage
      title="Purchase List"
      type="purchase"
      showProvider
      showVoucher
      ticketView="ranges"
    />
  );
}
