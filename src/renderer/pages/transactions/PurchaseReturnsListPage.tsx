import TransactionListPage from '../../components/transactions/TransactionListPage';

export default function PurchaseReturnsListPage() {
  return (
    <TransactionListPage
      title="Purchase Returns"
      type="purchase_return"
      showProvider
      showVoucher
      ticketView="ranges"
    />
  );
}
