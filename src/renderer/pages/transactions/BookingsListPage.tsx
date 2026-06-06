import TransactionListPage from '../../components/transactions/TransactionListPage';

export default function BookingsListPage() {
  return (
    <TransactionListPage title="Bookings" type="booking" showBuyer ticketView="tickets" />
  );
}
