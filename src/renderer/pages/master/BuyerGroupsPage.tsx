import GroupCrudPage from '../../components/GroupCrudPage';
import {
  buyerGroupsCreate,
  buyerGroupsDelete,
  buyerGroupsList,
  buyerGroupsUpdate,
} from '../../lib/api';

export default function BuyerGroupsPage() {
  return (
    <GroupCrudPage
      title="Buyer Groups"
      entityName="buyer group"
      listFn={buyerGroupsList}
      createFn={buyerGroupsCreate}
      updateFn={buyerGroupsUpdate}
      deleteFn={buyerGroupsDelete}
    />
  );
}
