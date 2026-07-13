import GroupCrudPage from '../../components/GroupCrudPage';
import { api } from '../../lib/api';

export default function ItemGroupsPage() {
  return (
    <GroupCrudPage
      title="Item Groups"
      entityName="item group"
      listFn={api.itemGroupsList}
      createFn={api.itemGroupsCreate}
      updateFn={api.itemGroupsUpdate}
      deleteFn={api.itemGroupsDelete}
    />
  );
}
