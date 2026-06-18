import TransactionListPage from '../../components/transactions/TransactionListPage';

export default function SaleListPage() {
  return (
    <TransactionListPage
      title="Sale List"
      type="sale"
      showBuyer
      ticketView="tickets"
      showReturnStats
    />
  );
}
