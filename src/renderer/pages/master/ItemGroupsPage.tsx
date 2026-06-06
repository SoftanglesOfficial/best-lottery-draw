import GroupCrudPage from '../../components/GroupCrudPage';
import {
  itemGroupsCreate,
  itemGroupsDelete,
  itemGroupsList,
  itemGroupsUpdate,
} from '../../lib/api';

export default function ItemGroupsPage() {
  return (
    <GroupCrudPage
      title="Item Groups"
      entityName="item group"
      listFn={itemGroupsList}
      createFn={itemGroupsCreate}
      updateFn={itemGroupsUpdate}
      deleteFn={itemGroupsDelete}
    />
  );
}
