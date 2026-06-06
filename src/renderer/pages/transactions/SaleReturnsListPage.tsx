import TransactionListPage from '../../components/transactions/TransactionListPage';

export default function SaleReturnsListPage() {
  return (
    <TransactionListPage
      title="Sale Returns"
      type="sale_return"
      showBuyer
      ticketView="tickets"
    />
  );
}
