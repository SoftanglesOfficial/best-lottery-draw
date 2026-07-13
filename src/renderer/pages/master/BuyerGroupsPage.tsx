import GroupCrudPage from '../../components/GroupCrudPage';
import { api } from '../../lib/api';

export default function BuyerGroupsPage() {
  return (
    <GroupCrudPage
      title="Buyer Groups"
      entityName="buyer group"
      listFn={api.buyerGroupsList}
      createFn={api.buyerGroupsCreate}
      updateFn={api.buyerGroupsUpdate}
      deleteFn={api.buyerGroupsDelete}
    />
  );
}
